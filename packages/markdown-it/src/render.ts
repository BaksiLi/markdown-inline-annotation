import type { AnnotationPosition, InlineAnnotationModel, UnderlineStyle } from "./model.js";
import type { ResolvedOptions } from "./options.js";
import { AnnotationScanner, hasInlineAnnotation, opposite, positionForOp } from "./parse.js";

export interface RenderOutput<Content> {
  text(value: string): Content;
  join(parts: Content[]): Content;
  span(base: Content, classes: string, style: string): Content;
  ruby(base: Content, annotation: string, classes: string, style: string, open: string, close: string): Content;
}

interface Decoration {
  kind: "bouten" | "line";
  position: AnnotationPosition;
  style: UnderlineStyle;
}

const lineStyles = new Map<string, UnderlineStyle>([[".-", "solid"], [".~", "wavy"], [".=", "double"]]);
const underlineOffset = "text-underline-offset:0.15em";
const boutenOverStyle =
  "text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right";

export function unescapeMarkup(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

function decorationClasses(prefix: string, decoration: Decoration): string {
  const { kind, position, style } = decoration;
  if (kind === "bouten") return `${prefix}-bouten-${position}`;
  const line = position === "over" ? "overline" : "underline";
  const base = `${prefix}-${line}`;
  return style === "solid" ? base : `${base} ${base}-${style}`;
}

function decorationStyle(decoration: Decoration, standalone = false): string {
  const { kind, position, style } = decoration;
  if (kind === "bouten") {
    if (position === "over") return boutenOverStyle;
    return standalone
      ? `text-decoration-line:underline;${underlineOffset};text-decoration-style:dotted`
      : `text-decoration:underline dotted;${underlineOffset}`;
  }
  const line = position === "over" ? "overline" : "underline";
  const offset = position === "under" ? `;${underlineOffset}` : "";
  const decorationStyle = style === "solid" ? "" : `;text-decoration-style:${style}`;
  return `text-decoration-line:${line}${offset}${decorationStyle}`;
}

function alignedParts(value: string, baseLength: number, policy: ResolvedOptions["spaceAlignment"]): string[] | undefined {
  if (policy === "off" || !value.includes(" ")) return;
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length !== baseLength) return;
  // Conservative mode groups word glosses such as "Truth Value".
  if (policy === "always" || parts.some((part) => !/^[A-Za-z][A-Za-z'-]*$/.test(part))) return parts;
}

interface RubyLevel {
  value: string;
  position: AnnotationPosition;
}

interface RenderFrame<Content> {
  model: InlineAnnotationModel;
  parts: Content[];
  cursor: number;
  end: number;
}

export class AnnotationRenderer<Content> {
  private readonly prefix: string;
  private readonly open: string;
  private readonly close: string;

  constructor(private readonly output: RenderOutput<Content>, private readonly options: ResolvedOptions) {
    this.prefix = options.classPrefix;
    this.open = options.fallbackParens.charAt(0) || "(";
    this.close = options.fallbackParens.charAt(1) || ")";
  }

  private ruby(base: Content, value: string, position: AnnotationPosition, extraClasses = "", extraStyle = ""): Content {
    const classes = `${this.prefix}-ruby ${this.prefix}-ruby-${position}${extraClasses ? ` ${extraClasses}` : ""}`;
    // ruby-position is inherited. Both levels must set it explicitly.
    const style = this.options.inlineStyles
      ? `ruby-position:${position}${extraStyle ? `;${extraStyle}` : ""}`
      : "";
    return this.output.ruby(base, value, classes, style, this.open, this.close);
  }

  private decorations(base: Content, decorations: Decoration[]): Content {
    const bouten = decorations.some((decoration) => decoration.kind === "bouten");
    const rootClass = bouten ? `${this.prefix}-bouten` : "";
    const ordered = decorations.sort((a, b) => Number(a.position === "under") - Number(b.position === "under"));
    const styles = this.options.inlineStyles;
    // Independent wrappers let the overline and underline have different CSS styles.
    if (ordered.filter((decoration) => decoration.kind === "line" || decoration.position === "under").length > 1) {
      for (const decoration of ordered.reverse()) {
        const classes = decorationClasses(this.prefix, decoration);
        base = this.output.span(base, decoration.kind === "bouten" ? `${rootClass} ${classes}` : classes,
          styles ? decorationStyle(decoration) : "");
      }
      return base;
    }
    const classes = [rootClass, ...ordered.map((decoration) => decorationClasses(this.prefix, decoration))].filter(Boolean).join(" ");
    const style = styles ? ordered.map((decoration) => decorationStyle(decoration, true)).join(";") : "";
    return this.output.span(base, classes, style);
  }

  private rubyLevels(base: Content, plainBase: string, first: RubyLevel, second?: RubyLevel): Content {
    const policy = this.options.spaceAlignment;
    const baseChars = policy !== "off" && (first.value.includes(" ") || second?.value.includes(" ")) ? Array.from(plainBase) : [];
    const firstParts = alignedParts(first.value, baseChars.length, policy);
    const secondParts = second && alignedParts(second.value, baseChars.length, policy);
    const doubleClass = `${this.prefix}-ruby-double`;

    if (firstParts && secondParts && second) {
      return this.output.join(baseChars.map((character, index) => {
        const glyph = this.output.text(character);
        const a = firstParts[index];
        const b = secondParts[index];
        if (b === character) return this.ruby(glyph, a === character ? "" : a, first.position);
        if (a === character) return this.ruby(glyph, b, second.position);
        return this.ruby(this.ruby(glyph, a, first.position), b, second.position, doubleClass);
      }));
    }

    const aligned = firstParts ?? secondParts;
    if (aligned) {
      const position = firstParts ? first.position : second!.position;
      const outer = firstParts ? second : first;
      const glyphs = this.output.join(baseChars.map((character, index) => {
        const value = aligned[index] === character ? "" : aligned[index];
        return this.ruby(this.output.text(character), value, position);
      }));
      return outer ? this.ruby(glyphs, outer.value, outer.position, doubleClass) : glyphs;
    }

    const inner = this.ruby(base, first.value, first.position);
    return second ? this.ruby(inner, second.value, second.position, doubleClass) : inner;
  }

  model(model: InlineAnnotationModel): Content {
    const source = model.base.raw;
    if (hasInlineAnnotation(source)) {
      const scanner = new AnnotationScanner(source, source.length, this.options.enableAbbreviated);
      const nested = scanner.find(0);
      if (nested) return this.renderModel(model, this.renderMatches(source, scanner, nested), "");
    }
    return this.renderPlainModel(model);
  }

  private renderPlainModel(model: InlineAnnotationModel): Content {
    const plainBase = unescapeMarkup(model.base.raw);
    return this.renderModel(model, this.output.text(plainBase), plainBase);
  }

  private renderModel(model: InlineAnnotationModel, base: Content, plainBase: string): Content {
    const decorations: Decoration[] = [];
    const rubies: RubyLevel[] = [];
    for (const slot of model.slots) {
      const lineStyle = lineStyles.get(slot.raw);
      if (slot.raw === "..") decorations.push({ kind: "bouten", position: slot.position, style: "solid" });
      else if (lineStyle) decorations.push({ kind: "line", position: slot.position, style: lineStyle });
      else rubies.push({ value: unescapeMarkup(slot.raw), position: slot.position });
    }

    let rendered: Content;
    if (rubies.length === 0) {
      rendered = this.decorations(base, decorations);
    } else if (rubies.length === 1 && decorations.length === 1) {
      const [ruby] = rubies;
      const [decoration] = decorations;
      rendered = this.ruby(base, ruby.value, ruby.position,
        `${this.prefix}-ruby-mixed ${decorationClasses(this.prefix, decoration)}`,
        this.options.inlineStyles ? decorationStyle(decoration) : "");
    } else {
      // Grouped ruby nesting follows the primary operator and its opposite.
      const first = { value: rubies[0].value, position: positionForOp(model.primaryOp) };
      const second = rubies[1] && { value: rubies[1].value, position: positionForOp(opposite(model.primaryOp)) };
      rendered = this.rubyLevels(base, plainBase, first, second);
    }

    if (!model.overflow.length) return rendered;
    return this.output.join([rendered, ...model.overflow.map((range) => this.output.text(unescapeMarkup(range.raw)))]);
  }

  private renderMatches(input: string, scanner: AnnotationScanner, first: InlineAnnotationModel): Content {
    // All nested bases are bounded ranges of the same source. Keep delimiter
    // lookahead shared and finish parent models after their nested bases.
    const parents: RenderFrame<Content>[] = [];
    let parts: Content[] = [];
    let cursor = 0;
    let end = input.length;
    let model: InlineAnnotationModel | null = first;
    for (;;) {
      if (model) {
        if (model.start > cursor) parts.push(this.output.text(unescapeMarkup(input.slice(cursor, model.start))));
        cursor = model.end;
        const nested: InlineAnnotationModel | null = model.form === "bracketed"
          ? scanner.find(model.base.start, model.base.end)
          : null;
        if (nested) {
          parents.push({ model, parts, cursor, end });
          ({ start: cursor, end } = model.base);
          parts = [];
          model = nested;
          continue;
        }
        parts.push(this.renderPlainModel(model));
      } else {
        if (cursor < end) parts.push(this.output.text(unescapeMarkup(input.slice(cursor, end))));
        const rendered = parts.length === 1 ? parts[0] : this.output.join(parts);
        const parent = parents.pop();
        if (!parent) return rendered;
        ({ parts, cursor, end } = parent);
        parts.push(this.renderModel(parent.model, rendered, ""));
      }
      model = scanner.find(cursor, end);
    }
  }

  source(input: string): Content {
    if (hasInlineAnnotation(input)) {
      const scanner = new AnnotationScanner(input, input.length, this.options.enableAbbreviated);
      const first = scanner.find(0);
      if (first) return this.renderMatches(input, scanner, first);
    }
    return this.output.text(unescapeMarkup(input));
  }
}
