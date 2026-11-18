export type AnnotationOp = "^^" | "^_";
export type AnnotationPosition = "over" | "under";
export type SpaceAlignmentPolicy = "always" | "auto" | "off";
export type UnderlineStyle = "solid" | "wavy" | "double";

export interface InlineAnnotationOptions {
  classPrefix?: string;
  enableAbbreviated?: boolean;
  spaceAlignment?: SpaceAlignmentPolicy;
  enableSpaceAlignment?: boolean;
  inlineStyles?: boolean;
  fallbackParens?: string;
}

export type InlineAnnotationForm = "bracketed" | "abbreviated";
export type InlineAnnotationSlotSource = "primary" | "pipe" | "chain";

/** A zero-based, end-exclusive UTF-16 range into the exact original source. */
export interface InlineAnnotationRange {
  start: number;
  end: number;
  /** The original source slice, including any backslash escapes. */
  raw: string;
}

export interface InlineAnnotationSlot extends InlineAnnotationRange {
  position: AnnotationPosition;
  source: InlineAnnotationSlotSource;
}

export type InlineAnnotationDecoration =
  | { kind: "bouten"; position: AnnotationPosition }
  | { kind: "line"; position: AnnotationPosition; style: UnderlineStyle };

export type InlineAnnotationSlotContent = InlineAnnotationDecoration | { kind: "ruby"; raw: string };

export interface InlineAnnotationModel {
  form: InlineAnnotationForm;
  /** Zero-based, end-exclusive UTF-16 offsets into the original source. */
  start: number;
  end: number;
  /** The exact original source slice from start to end. */
  source: string;
  base: InlineAnnotationRange;
  primaryOp: AnnotationOp;
  slots: InlineAnnotationSlot[];
  overflow: InlineAnnotationRange[];
}

export interface InlineAnnotationMatch {
  /** Zero-based, end-exclusive UTF-16 offsets into the original source. */
  start: number;
  end: number;
  html: string;
  /** The exact original source slice from start to end. */
  source: string;
  model: InlineAnnotationModel;
}

interface ParsedSlots {
  end: number;
  slots: InlineAnnotationSlot[];
  overflow: InlineAnnotationRange[];
}

interface ResolvedOptions {
  classPrefix: string;
  enableAbbreviated: boolean;
  spaceAlignment: SpaceAlignmentPolicy;
  inlineStyles: boolean;
  fallbackParens: string;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  classPrefix: "ia",
  enableAbbreviated: true,
  spaceAlignment: "always",
  inlineStyles: true,
  fallbackParens: "()",
};

const BOUTEN_PATTERN = "..";
const UNDERLINE_STYLES = new Map<string, UnderlineStyle>([
  [".-", "solid"],
  [".~", "wavy"],
  [".=", "double"],
]);

const STYLE_BOUTEN_OVER =
  "text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right";
const STYLE_BOUTEN_UNDER = "text-decoration:underline dotted;text-underline-offset:0.15em";
const STYLE_RUBY_OVER = "ruby-position:over";
const STYLE_RUBY_UNDER = "ruby-position:under";

function resolveOptions(options?: InlineAnnotationOptions): ResolvedOptions {
  const resolved: ResolvedOptions = {
    classPrefix: options?.classPrefix ?? DEFAULT_OPTIONS.classPrefix,
    enableAbbreviated: options?.enableAbbreviated ?? DEFAULT_OPTIONS.enableAbbreviated,
    spaceAlignment: options?.spaceAlignment ?? DEFAULT_OPTIONS.spaceAlignment,
    inlineStyles: options?.inlineStyles ?? DEFAULT_OPTIONS.inlineStyles,
    fallbackParens: options?.fallbackParens ?? DEFAULT_OPTIONS.fallbackParens,
  };
  if (!options?.spaceAlignment && typeof options?.enableSpaceAlignment === "boolean") {
    resolved.spaceAlignment = options.enableSpaceAlignment ? "always" : "off";
  }
  return resolved;
}

function isEscaped(input: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && input[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

function unescapeMarkup(input: string): string {
  return input.replace(/\\(.)/g, "$1");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapedText(input: string): string {
  return escapeHtml(unescapeMarkup(input));
}

function range(input: string, start: number, end: number): InlineAnnotationRange {
  return { start, end, raw: input.slice(start, end) };
}

function findUnescapedPipe(input: string, start: number, end: number): number {
  for (let i = start; i < end; i++) {
    if (input[i] === "|" && !isEscaped(input, i)) return i;
  }
  return end;
}

function findCloseParen(input: string, start: number, max: number): number {
  let depth = 0;
  for (let i = start; i < max; i++) {
    if (input[i] === "\n" || input[i] === "\r") return -1;
    if (input[i] === "(" && !isEscaped(input, i)) depth++;
    if (input[i] === ")" && !isEscaped(input, i)) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function findBracketClose(input: string, start: number, max: number): number {
  let depth = 0;
  for (let i = start; i < max; i++) {
    const ch = input[i];
    if (ch === "\n" || ch === "\r") return -1;
    if (ch === "[" && !isEscaped(input, i)) depth++;
    if (ch === "]" && !isEscaped(input, i)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function opAt(input: string, index: number, max: number): AnnotationOp | null {
  if (index + 2 >= max || input[index] !== "^" || input[index + 2] !== "(") return null;
  if (isEscaped(input, index)) return null;
  if (input[index + 1] === "^") return "^^";
  if (input[index + 1] === "_") return "^_";
  return null;
}

function opposite(op: AnnotationOp): AnnotationOp {
  return op === "^^" ? "^_" : "^^";
}

function positionForOp(op: AnnotationOp): AnnotationPosition {
  return op === "^^" ? "over" : "under";
}

function className(options: ResolvedOptions, suffix: string): string {
  return `${options.classPrefix}-${suffix}`;
}

function attrStyle(style: string, options: ResolvedOptions): string {
  return options.inlineStyles && style ? ` style="${style}"` : "";
}

function rubyPositionStyle(position: AnnotationPosition): string {
  // Emit the position explicitly for both slots. `ruby-position` is a CSS
  // inherited property, so a nested over-ruby placed inside an under-ruby would
  // otherwise inherit `under` and render both annotations below the base.
  return position === "under" ? STYLE_RUBY_UNDER : STYLE_RUBY_OVER;
}

// A line mark renders as an overline in the over slot and an underline in the
// under slot. The slot decides the side; the glyph (.-/.~/.=) decides the style.
function lineKeyword(position: AnnotationPosition): string {
  return position === "over" ? "overline" : "underline";
}

function lineCss(position: AnnotationPosition, style: UnderlineStyle): string {
  let css = `text-decoration-line:${lineKeyword(position)}`;
  if (position === "under") css += ";text-underline-offset:0.15em";
  if (style === "wavy") css += ";text-decoration-style:wavy";
  else if (style === "double") css += ";text-decoration-style:double";
  return css;
}

function boutenStyle(position: AnnotationPosition): string {
  return position === "over" ? STYLE_BOUTEN_OVER : STYLE_BOUTEN_UNDER;
}

function lineClass(options: ResolvedOptions, position: AnnotationPosition, style: UnderlineStyle): string {
  const keyword = lineKeyword(position);
  const base = className(options, keyword);
  return style === "solid" ? base : `${base} ${className(options, `${keyword}-${style}`)}`;
}

function decorationRank(position: AnnotationPosition): number {
  return position === "over" ? 0 : 1;
}

function renderIndependentTextDecorations(baseHtml: string, decos: InlineAnnotationDecoration[], options: ResolvedOptions): string {
  const ordered = [...decos].sort((a, b) => decorationRank(a.position) - decorationRank(b.position));
  let html = baseHtml;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const deco = ordered[i];
    const classes =
      deco.kind === "bouten"
        ? [className(options, "bouten"), className(options, `bouten-${deco.position}`)].join(" ")
        : lineClass(options, deco.position, deco.style);
    const style = deco.kind === "bouten" ? boutenStyle(deco.position) : lineCss(deco.position, deco.style);
    html = `<span class="${classes}"${attrStyle(style, options)}>${html}</span>`;
  }
  return html;
}

function splitBySpaces(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function isPlainAsciiWord(text: string): boolean {
  return /^[A-Za-z][A-Za-z'-]*$/.test(text);
}

function shouldAlignBySpaces(plainBase: string, parts: string[], options: ResolvedOptions): boolean {
  if (options.spaceAlignment === "off") return false;
  const baseChars = Array.from(plainBase);
  if (parts.length !== baseChars.length) return false;
  if (options.spaceAlignment === "always") return true;

  // Auto mode is conservative: keep ordinary multi-word glosses such as
  // "Truth Value" grouped, but still align kana, bopomofo, and marked pinyin.
  return !parts.every(isPlainAsciiWord);
}

function shouldHideAnnotation(baseChar: string, annotation: string): boolean {
  return baseChar === annotation;
}

function renderEmptyRuby(baseHtml: string, position: AnnotationPosition, options: ResolvedOptions): string {
  const rubyClass = `${className(options, "ruby")} ${className(options, `ruby-${position}`)}`;
  const open = options.fallbackParens.charAt(0) || "(";
  const close = options.fallbackParens.charAt(1) || ")";
  return `<ruby class="${rubyClass}"${attrStyle(rubyPositionStyle(position), options)}>${baseHtml}<rp>${open}</rp><rt></rt><rp>${close}</rp></ruby>`;
}

function renderRubyElement(
  baseHtml: string,
  annotationHtml: string,
  position: AnnotationPosition,
  options: ResolvedOptions,
  extraClasses = "",
  extraStyle = ""
): string {
  const classes = [`${className(options, "ruby")}`, className(options, `ruby-${position}`), extraClasses]
    .filter(Boolean)
    .join(" ");
  const styles = [rubyPositionStyle(position), extraStyle].filter(Boolean).join(";");
  const open = options.fallbackParens.charAt(0) || "(";
  const close = options.fallbackParens.charAt(1) || ")";
  return `<ruby class="${classes}"${attrStyle(styles, options)}>${baseHtml}<rp>${open}</rp><rt>${annotationHtml}</rt><rp>${close}</rp></ruby>`;
}

/** Classify exact raw slot text. An escaped mark remains ordinary ruby text. */
export function classifyInlineAnnotationSlot(raw: string, position: AnnotationPosition): InlineAnnotationSlotContent {
  if (raw === BOUTEN_PATTERN) return { kind: "bouten", position };
  const style = UNDERLINE_STYLES.get(raw);
  if (style) return { kind: "line", position, style };
  return { kind: "ruby", raw };
}

function renderDecorations(baseHtml: string, decos: InlineAnnotationDecoration[], options: ResolvedOptions): string {
  const textDecorationDecos = decos.filter((deco) => deco.kind === "line" || deco.position === "under");
  const boutenOver = decos.find((deco) => deco.kind === "bouten" && deco.position === "over");

  // CSS gives one element only one `text-decoration-style`, shared by every
  // overline/underline on that element. Use independent wrappers when both
  // sides need text-decoration so `. -` above and `.~` below do not collapse
  // into a single style.
  if (textDecorationDecos.length > 1) {
    const html = renderIndependentTextDecorations(baseHtml, textDecorationDecos, options);
    if (!boutenOver) return html;
    const classes = [className(options, "bouten"), className(options, "bouten-over")].join(" ");
    return `<span class="${classes}"${attrStyle(STYLE_BOUTEN_OVER, options)}>${html}</span>`;
  }

  const classes: string[] = [];
  let emphasis = ""; // bouten over uses text-emphasis (independent of text-decoration)
  const decorationLines: string[] = []; // merged into one text-decoration-line value
  let decorationStyle = ""; // text-decoration-style is shared across all lines on a span
  let underlineOffset = false;

  if (decos.some((d) => d.kind === "bouten")) classes.push(className(options, "bouten"));

  // Over before under so the merged text-decoration-line reads "overline underline".
  const ordered = [...decos].sort((a, b) => (a.position === b.position ? 0 : a.position === "over" ? -1 : 1));
  for (const deco of ordered) {
    if (deco.kind === "bouten") {
      classes.push(className(options, `bouten-${deco.position}`));
      if (deco.position === "over") {
        emphasis = STYLE_BOUTEN_OVER;
      } else {
        decorationLines.push("underline");
        decorationStyle = decorationStyle || "dotted";
        underlineOffset = true;
      }
    } else {
      classes.push(lineClass(options, deco.position, deco.style));
      decorationLines.push(lineKeyword(deco.position));
      if (deco.position === "under") underlineOffset = true;
      if (deco.style === "wavy") decorationStyle = "wavy";
      else if (deco.style === "double") decorationStyle = "double";
    }
  }

  const styleParts: string[] = [];
  if (emphasis) styleParts.push(emphasis);
  if (decorationLines.length) {
    // A single text-decoration-line declaration carries every line so that an
    // overline and an underline can coexist (two declarations would collide).
    styleParts.push(`text-decoration-line:${decorationLines.join(" ")}`);
    if (underlineOffset) styleParts.push("text-underline-offset:0.15em");
    if (decorationStyle) styleParts.push(`text-decoration-style:${decorationStyle}`);
  }
  return `<span class="${classes.join(" ")}"${attrStyle(styleParts.join(";"), options)}>${baseHtml}</span>`;
}

function renderRubyWithDecoration(
  baseHtml: string,
  rubyHtml: string,
  rubyPosition: AnnotationPosition,
  deco: InlineAnnotationDecoration,
  options: ResolvedOptions
): string {
  const decoClass =
    deco.kind === "bouten"
      ? className(options, `bouten-${deco.position}`)
      : lineClass(options, deco.position, deco.style);
  const decoStyle = deco.kind === "bouten" ? boutenStyle(deco.position) : lineCss(deco.position, deco.style);
  return renderRubyElement(
    baseHtml,
    rubyHtml,
    rubyPosition,
    options,
    `${className(options, "ruby-mixed")} ${decoClass}`,
    decoStyle
  );
}

function renderRubyLevels(baseHtml: string, plainBase: string, op: AnnotationOp, levels: string[], options: ResolvedOptions): string {
  const capped = levels.slice(0, 2).map((level) => escapedText(level));
  const baseChars = Array.from(plainBase);
  const innerPos = positionForOp(op);
  const outerPos = positionForOp(opposite(op));
  const doubleClass = className(options, "ruby-double");

  if (capped.length === 2) {
    const raw1 = unescapeMarkup(levels[0]);
    const raw2 = unescapeMarkup(levels[1]);
    const ann1Parts = raw1.includes(" ") ? splitBySpaces(raw1) : null;
    const ann2Parts = raw2.includes(" ") ? splitBySpaces(raw2) : null;
    const can1Align = ann1Parts !== null && shouldAlignBySpaces(plainBase, ann1Parts, options);
    const can2Align = ann2Parts !== null && shouldAlignBySpaces(plainBase, ann2Parts, options);

    if (can1Align && can2Align) {
      return baseChars
        .map((char, i) => {
          const base = escapeHtml(char);
          const a1 = ann1Parts[i];
          const a2 = ann2Parts[i];
          const hide1 = shouldHideAnnotation(char, a1);
          const hide2 = shouldHideAnnotation(char, a2);
          if (hide1 && hide2) return renderEmptyRuby(base, innerPos, options);
          if (hide1) return renderRubyElement(base, escapeHtml(a2), outerPos, options);
          if (hide2) return renderRubyElement(base, escapeHtml(a1), innerPos, options);
          const inner = renderRubyElement(base, escapeHtml(a1), innerPos, options);
          return renderRubyElement(inner, escapeHtml(a2), outerPos, options, doubleClass);
        })
        .join("");
    }

    if (can1Align) {
      const inner = baseChars
        .map((char, i) => {
          const base = escapeHtml(char);
          const ann = ann1Parts[i];
          return shouldHideAnnotation(char, ann)
            ? renderEmptyRuby(base, innerPos, options)
            : renderRubyElement(base, escapeHtml(ann), innerPos, options);
        })
        .join("");
      return renderRubyElement(inner, capped[1], outerPos, options, doubleClass);
    }

    if (can2Align) {
      const inner = baseChars
        .map((char, i) => {
          const base = escapeHtml(char);
          const ann = ann2Parts[i];
          return shouldHideAnnotation(char, ann)
            ? renderEmptyRuby(base, outerPos, options)
            : renderRubyElement(base, escapeHtml(ann), outerPos, options);
        })
        .join("");
      return renderRubyElement(inner, capped[0], innerPos, options, doubleClass);
    }

    const inner = renderRubyElement(baseHtml, capped[0], innerPos, options);
    return renderRubyElement(inner, capped[1], outerPos, options, doubleClass);
  }

  if (capped.length === 1) {
    const raw = unescapeMarkup(levels[0]);
    if (raw.includes(" ")) {
      const parts = splitBySpaces(raw);
      if (shouldAlignBySpaces(plainBase, parts, options)) {
        return baseChars
          .map((char, i) => {
            const base = escapeHtml(char);
            const ann = parts[i];
            return shouldHideAnnotation(char, ann)
              ? renderEmptyRuby(base, innerPos, options)
              : renderRubyElement(base, escapeHtml(ann), innerPos, options);
          })
          .join("");
      }
    }
    return renderRubyElement(baseHtml, capped[0], innerPos, options);
  }

  return baseHtml;
}

export function renderInlineAnnotationModelToHtml(model: InlineAnnotationModel, rawOptions?: InlineAnnotationOptions): string {
  const options = resolveOptions(rawOptions);
  const baseRaw = model.base.raw;
  const nested = hasInlineAnnotation(baseRaw);
  const baseHtml = nested ? renderInlineAnnotationsToHtml(baseRaw, options) : escapedText(baseRaw);
  const plainBase = nested ? "" : unescapeMarkup(baseRaw);
  const overflowHtml = model.overflow.map((range) => escapedText(range.raw)).join("");
  const classified = model.slots.map((slot) => ({ slot, value: classifyInlineAnnotationSlot(slot.raw, slot.position) }));
  const decorations = classified
    .map(({ value }) => value)
    .filter((slot): slot is InlineAnnotationDecoration => slot.kind !== "ruby");
  const rubies = classified.filter((entry): entry is { slot: InlineAnnotationSlot; value: { kind: "ruby"; raw: string } } => {
    return entry.value.kind === "ruby";
  });

  // Pure decoration(s): bouten and/or over/under lines, no ruby text.
  if (rubies.length === 0) {
    return renderDecorations(baseHtml, decorations, options) + overflowHtml;
  }

  // One ruby slot paired with one decoration slot (e.g. ruby above + underline
  // below). The slot positions carry the side, so this stays correct whichever
  // operator order the author used.
  if (rubies.length === 1 && decorations.length === 1) {
    const ruby = rubies[0];
    return renderRubyWithDecoration(baseHtml, escapedText(ruby.value.raw), ruby.slot.position, decorations[0], options) + overflowHtml;
  }

  // One or two ruby slots: defer to the ruby renderer, which handles space
  // alignment and nested two-level ruby. Slot index 0 is the operator's own
  // position (inner), index 1 the opposite (outer) — the order renderRubyLevels
  // expects.
  return renderRubyLevels(baseHtml, plainBase, model.primaryOp, rubies.map((ruby) => ruby.value.raw), options) + overflowHtml;
}

function parseSlots(input: string, opStart: number, op: AnnotationOp, max: number): ParsedSlots | null {
  const annStart = opStart + 3;
  const annEnd = findCloseParen(input, annStart, max);
  if (annEnd <= annStart) return null;

  const firstPipe = findUnescapedPipe(input, annStart, annEnd);
  const slots: InlineAnnotationSlot[] = [
    { ...range(input, annStart, firstPipe), position: positionForOp(op), source: "primary" },
  ];
  const overflow: InlineAnnotationRange[] = [];
  const secondOp = opposite(op);
  const secondPosition = positionForOp(secondOp);
  let end = annEnd + 1;

  // A pipe has already filled both slots. Leave any following operator for
  // the host, and keep the remaining pipe content as one literal range.
  if (firstPipe < annEnd) {
    const secondPipe = findUnescapedPipe(input, firstPipe + 1, annEnd);
    slots.push({ ...range(input, firstPipe + 1, secondPipe), position: secondPosition, source: "pipe" });
    if (secondPipe < annEnd) overflow.push(range(input, secondPipe, annEnd));
  } else if (opAt(input, end, max) === secondOp) {
    const secondStart = end + 3;
    const secondEnd = findCloseParen(input, secondStart, max);
    if (secondEnd > secondStart) {
      slots.push({ ...range(input, secondStart, secondEnd), position: secondPosition, source: "chain" });
      end = secondEnd + 1;
    }
  }
  return { end, slots, overflow };
}

function parseWithBase(
  input: string, start: number, opStart: number, op: AnnotationOp, max: number, form: InlineAnnotationForm
): InlineAnnotationModel | null {
  const parsed = parseSlots(input, opStart, op, max);
  if (!parsed) return null;
  const bracketed = form === "bracketed";
  const { end, slots, overflow } = parsed;
  return {
    form,
    start,
    end,
    source: input.slice(start, end),
    base: range(input, bracketed ? start + 1 : start, bracketed ? opStart - 1 : opStart),
    primaryOp: op,
    slots,
    overflow,
  };
}

function parseBracketedAt(input: string, start: number, max: number): InlineAnnotationModel | null {
  if (input[start] !== "[" || isEscaped(input, start)) return null;
  const close = findBracketClose(input, start, max);
  if (close < 0) return null;
  const opStart = close + 1;
  const op = opAt(input, opStart, max);
  return op ? parseWithBase(input, start, opStart, op, max, "bracketed") : null;
}

function isAbbreviatedBoundary(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch) || "[]()<>`*&!".includes(ch);
}

function parseAbbreviatedAt(input: string, start: number, max: number, options: ResolvedOptions): InlineAnnotationModel | null {
  if (!options.enableAbbreviated || isAbbreviatedBoundary(input[start]) || input[start] === "^") return null;

  for (let i = start + 1; i < max; i++) {
    const op = opAt(input, i, max);
    if (op) return parseWithBase(input, start, i, op, max, "abbreviated");
    if (isAbbreviatedBoundary(input[i]) || input[i] === "^") return null;
  }

  return null;
}

function parseAt(input: string, start: number, max: number, options: ResolvedOptions): InlineAnnotationModel | null {
  return parseBracketedAt(input, start, max) ?? parseAbbreviatedAt(input, start, max, options);
}

function isMarkdownBlocker(ch: string): boolean {
  // Match markdown-it's text-rule terminators. Scanning across one of these
  // would turn host syntax into a plain text token before its own rule runs.
  return ch === "\r" || /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/.test(ch);
}

function findInlineAnnotationModelIn(
  input: string,
  start: number,
  max: number,
  rawOptions: InlineAnnotationOptions | undefined,
  stopBeforeMarkdown: boolean
): InlineAnnotationModel | null {
  const options = resolveOptions(rawOptions);
  for (let i = start; i < max; i++) {
    const model = parseAt(input, i, max, options);
    if (model) return model;
    if (stopBeforeMarkdown && isMarkdownBlocker(input[i])) return null;
  }
  return null;
}

function matchFromModel(model: InlineAnnotationModel, options: InlineAnnotationOptions | undefined): InlineAnnotationMatch {
  return {
    start: model.start,
    end: model.end,
    source: model.source,
    html: renderInlineAnnotationModelToHtml(model, options),
    model,
  };
}

function findInlineAnnotationModelsIn(
  input: string,
  start: number,
  max: number,
  rawOptions: InlineAnnotationOptions | undefined,
  stopBeforeMarkdown: boolean
): InlineAnnotationModel[] {
  const models: InlineAnnotationModel[] = [];
  let pos = start;

  while (pos < max) {
    const model = findInlineAnnotationModelIn(input, pos, max, rawOptions, stopBeforeMarkdown);
    if (!model) break;
    models.push(model);
    pos = model.end > pos ? model.end : pos + 1;
  }

  return models;
}

export function findInlineAnnotationModel(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationModel | null {
  return findInlineAnnotationModelIn(input, start, max, rawOptions, false);
}

export function findInlineAnnotationModelBeforeMarkdown(
  input: string,
  start = 0,
  max = input.length,
  rawOptions?: InlineAnnotationOptions
): InlineAnnotationModel | null {
  return findInlineAnnotationModelIn(input, start, max, rawOptions, true);
}

export function findInlineAnnotationModels(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationModel[] {
  return findInlineAnnotationModelsIn(input, start, max, rawOptions, false);
}

export function findInlineAnnotationModelsBeforeMarkdown(
  input: string,
  start = 0,
  max = input.length,
  rawOptions?: InlineAnnotationOptions
): InlineAnnotationModel[] {
  return findInlineAnnotationModelsIn(input, start, max, rawOptions, true);
}

export function findInlineAnnotation(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationMatch | null {
  const model = findInlineAnnotationModel(input, start, max, rawOptions);
  return model ? matchFromModel(model, rawOptions) : null;
}

export function findInlineAnnotationBeforeMarkdown(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationMatch | null {
  const model = findInlineAnnotationModelBeforeMarkdown(input, start, max, rawOptions);
  return model ? matchFromModel(model, rawOptions) : null;
}

export function renderInlineAnnotationsToHtml(input: string, rawOptions?: InlineAnnotationOptions): string {
  const options = resolveOptions(rawOptions);
  let html = "";
  let pos = 0;

  while (pos < input.length) {
    const match = findInlineAnnotation(input, pos, input.length, options);
    if (!match) {
      html += escapedText(input.slice(pos));
      break;
    }
    html += escapedText(input.slice(pos, match.start));
    html += match.html;
    pos = match.end;
  }

  return html;
}

export function hasInlineAnnotation(input: string): boolean {
  return input.includes("^^(") || input.includes("^_(");
}

export const inlineAnnotationDefaults = DEFAULT_OPTIONS;
