import {
  classifyInlineAnnotationSlot,
  findInlineAnnotationModel,
  findInlineAnnotationModels,
  hasInlineAnnotation,
  renderInlineAnnotationModelToHtml,
  type InlineAnnotationModel,
  type UnderlineStyle,
} from "markdown-it-inline-annotation/core";
import { conversionHtmlRanges, convertOutsideCode, isEscaped } from "./source";

/**
 * Ruby (Furigana) parser implementing the proposal syntax.
 *
 * ## Supported Syntax
 * - **Bracketed**: `[base]^^(annotation)` and `[base]^_(annotation)`
 * - **Abbreviated**: `base^^(annotation)` and `base^_(annotation)`
 * - **Multi-level**: `[base]^^(ann1|ann2)` pipe-separated levels (max 2)
 * - **Chained**: `[base]^^(over)^_(under)` — mixed-operator only
 * - **Bouten**: `[漢字]^^(..)` / `[漢字]^_(..)` — emphasis dots
 * - **Both bouten**: `[漢字]^^(..)^_(..)` — dots above + below (ruby + text-emphasis)
 * - **Line marks**: `[base]^^(.-)` / `[base]^_(.-)` — overline/underline
 * - **Parentheses**: balanced literal parentheses inside annotations
 * - **Escapes**: `\|`, `\(`, `\)`, `\]`, `\\` inside base/annotation
 *
 * Reference: https://blog.baksili.codes/markdown-ruby
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RubyOp = "^^" | "^_";

const BOUTEN_PATTERN = "..";
const GENERATED_ANNOTATION_HTML_RE =
  /<(?:ruby|span)\b[^>]*\bclass=(?:"[^"]*\bia-(?:ruby|bouten|underline|overline)\b[^"]*"|'[^']*\bia-(?:ruby|bouten|underline|overline)\b[^']*')/i;

function lineKeyword(op: RubyOp): "overline" | "underline" {
  return op === "^^" ? "overline" : "underline";
}

function lineClasses(op: RubyOp, style: UnderlineStyle): string {
  const keyword = lineKeyword(op);
  if (style === "solid") return `ia-${keyword}`;
  return `ia-${keyword} ia-${keyword}-${style}`;
}

function underlinePatternFromClasses(el: Element): string | null {
  if (el.classList.contains("ia-underline-wavy")) return ".~";
  if (el.classList.contains("ia-underline-double")) return ".=";
  if (el.classList.contains("ia-underline")) return ".-";
  return null;
}

function overlinePatternFromClasses(el: Element): string | null {
  if (el.classList.contains("ia-overline-wavy")) return ".~";
  if (el.classList.contains("ia-overline-double")) return ".=";
  if (el.classList.contains("ia-overline")) return ".-";
  return null;
}

function firstDirectChildByTag(el: Element, tag: string): Element | null {
  const upper = tag.toUpperCase();
  return Array.from(el.children).find((c) => c.tagName === upper) ?? null;
}

function unescape(input: string): string {
  return input.replace(/\\(.)/g, "$1");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMarkupBase(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/[\[\]]|\^(?=(?:\^|_)\()/g, "\\$&");
}

function escapeMarkupAnnotation(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/[|()]/g, "\\$&");
}

function formatRubyMarkupLevels(base: string, op: RubyOp, levels: string[]): string {
  const slots = levels.map((level) => {
    const escaped = escapeMarkupAnnotation(level);
    return isDecorationPattern(level) ? `\\${escaped}` : escaped;
  }).join("|");
  return `[${escapeMarkupBase(base)}]${op}(${slots})`;
}

function escapeMacroAnnotation(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function isDecorationPattern(raw: string): boolean {
  return classifyInlineAnnotationSlot(raw, "over").kind !== "ruby";
}

function convertAnnotationSlot(
  raw: string,
  escape: (text: string) => string,
  allowDecoration: boolean,
): string {
  const value = unescape(raw);
  const escaped = escape(value);
  return isDecorationPattern(value) && !(allowDecoration && raw === value) ? `\\${escaped}` : escaped;
}

function splitByUnescapedPipe(input: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "|" && !isEscaped(input, i)) {
      out.push(buf);
      buf = "";
    } else {
      buf += input[i];
    }
  }
  out.push(buf);
  return out;
}

// ---------------------------------------------------------------------------
// Inline style constants (for HTML portability outside Logseq)
// ---------------------------------------------------------------------------

const STYLE_BOUTEN_OVER = "text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right";
const STYLE_BOUTEN_UNDER = "text-decoration:underline dotted;text-underline-offset:0.15em";
const STYLE_RUBY_UNDER = "ruby-position:under";

function underlineInlineStyle(style: UnderlineStyle): string {
  let s = "text-decoration-line:underline;text-underline-offset:0.15em";
  if (style === "wavy") s += ";text-decoration-style:wavy";
  else if (style === "double") s += ";text-decoration-style:double";
  return s;
}

function lineInlineStyle(op: RubyOp, style: UnderlineStyle): string {
  if (op === "^_") return underlineInlineStyle(style);
  let s = "text-decoration-line:overline";
  if (style === "wavy") s += ";text-decoration-style:wavy";
  else if (style === "double") s += ";text-decoration-style:double";
  return s;
}

function boutenInlineStyle(op: RubyOp): string {
  return op === "^^" ? STYLE_BOUTEN_OVER : STYLE_BOUTEN_UNDER;
}

/** Set both positions explicitly for nested ruby. */
function rubyPosAttr(pos: string): string {
  return pos === "ia-ruby-under" ? ` style="${STYLE_RUBY_UNDER}"` : ' style="ruby-position:over"';
}

/** Wrap a character in an empty-annotation ruby to preserve vertical spacing */
function emptyRuby(char: string, pos: string): string {
  return `<ruby class="ia-ruby ${pos}"${rubyPosAttr(pos)}>${char}<rp>(</rp><rt></rt><rp>)</rp></ruby>`;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * Bouten rendering.
 * - Over (^^): real CSS text-emphasis dots — works perfectly in Chromium.
 * - Under (^_): dotted underline fallback — text-emphasis-position:under
 *   is unreliably clipped by Logseq's Electron container. Dotted underline
 *   is semantically close and renders stably.
 */
function renderBouten(base: string, op: RubyOp): string {
  const pos = op === "^^" ? "ia-bouten-over" : "ia-bouten-under";
  return `<span class="ia-bouten ${pos}" style="${boutenInlineStyle(op)}">${escapeHtml(unescape(base))}</span>`;
}

function renderLine(base: string, op: RubyOp, style: UnderlineStyle = "solid"): string {
  return `<span class="${lineClasses(op, style)}" style="${lineInlineStyle(op, style)}">${escapeHtml(unescape(base))}</span>`;
}

/**
 * Split annotation by spaces, trimming each part
 */
function splitBySpaces(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Check if annotation can be auto-hidden (matches base character)
 */
function shouldHideAnnotation(baseChar: string, annotation: string): boolean {
  return baseChar === annotation;
}

function renderRuby(base: string, op: RubyOp, levels: string[]): string {
  const safeBase = escapeHtml(unescape(base));
  const capped = levels.slice(0, 2);
  const baseChars = Array.from(unescape(base));

  // --- Two levels: try per-character alignment independently for each level ---
  if (capped.length === 2) {
    const ann1Parts = capped[0].includes(" ") ? splitBySpaces(capped[0]) : null;
    const ann2Parts = capped[1].includes(" ") ? splitBySpaces(capped[1]) : null;
    const can1Align = ann1Parts !== null && ann1Parts.length === baseChars.length;
    const can2Align = ann2Parts !== null && ann2Parts.length === baseChars.length;
    const innerPos = op === "^^" ? "ia-ruby-over" : "ia-ruby-under";
    const outerPos = op === "^^" ? "ia-ruby-under" : "ia-ruby-over";

    if (can1Align && can2Align) {
      // Both levels per-character aligned
      let result = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const a1 = ann1Parts[i];
        const a2 = ann2Parts[i];
        const hide1 = shouldHideAnnotation(char, a1);
        const hide2 = shouldHideAnnotation(char, a2);
        if (hide1 && hide2) {
          result += emptyRuby(escapeHtml(char), innerPos);
        } else if (hide1) {
          result += `<ruby class="ia-ruby ${outerPos}"${rubyPosAttr(outerPos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(a2)}</rt><rp>)</rp></ruby>`;
        } else if (hide2) {
          result += `<ruby class="ia-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(a1)}</rt><rp>)</rp></ruby>`;
        } else {
          result += `<ruby class="ia-ruby ${outerPos} ia-ruby-double"${rubyPosAttr(outerPos)}><ruby class="ia-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(a1)}</rt><rp>)</rp></ruby><rp>(</rp><rt>${escapeHtml(a2)}</rt><rp>)</rp></ruby>`;
        }
      }
      return result;
    }

    if (can1Align) {
      // First level per-character, second level group
      let innerRubies = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = ann1Parts[i];
        if (shouldHideAnnotation(char, ann)) {
          innerRubies += emptyRuby(escapeHtml(char), innerPos);
        } else {
          innerRubies += `<ruby class="ia-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(ann)}</rt><rp>)</rp></ruby>`;
        }
      }
      return (
        `<ruby class="ia-ruby ${outerPos} ia-ruby-double"${rubyPosAttr(outerPos)}>` +
        innerRubies +
        `<rp>(</rp><rt>${escapeHtml(capped[1])}</rt><rp>)</rp></ruby>`
      );
    }

    if (can2Align) {
      // First level group, second level per-character
      let innerRubies = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = ann2Parts[i];
        if (shouldHideAnnotation(char, ann)) {
          innerRubies += emptyRuby(escapeHtml(char), outerPos);
        } else {
          innerRubies += `<ruby class="ia-ruby ${outerPos}"${rubyPosAttr(outerPos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(ann)}</rt><rp>)</rp></ruby>`;
        }
      }
      return (
        `<ruby class="ia-ruby ${innerPos} ia-ruby-double"${rubyPosAttr(innerPos)}>` +
        innerRubies +
        `<rp>(</rp><rt>${escapeHtml(capped[0])}</rt><rp>)</rp></ruby>`
      );
    }

    // Neither can align: standard double-level group ruby
    return (
      `<ruby class="ia-ruby ${outerPos} ia-ruby-double"${rubyPosAttr(outerPos)}>` +
      `<ruby class="ia-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${safeBase}<rp>(</rp><rt>${escapeHtml(capped[0])}</rt><rp>)</rp></ruby>` +
      `<rp>(</rp><rt>${escapeHtml(capped[1])}</rt><rp>)</rp></ruby>`
    );
  }

  // --- Single level: try per-character alignment ---
  if (capped.length === 1 && capped[0].includes(" ")) {
    const annParts = splitBySpaces(capped[0]);
    if (annParts.length === baseChars.length) {
      let result = "";
      const pos = op === "^^" ? "ia-ruby-over" : "ia-ruby-under";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = annParts[i];
        if (shouldHideAnnotation(char, ann)) {
          result += emptyRuby(escapeHtml(char), pos);
        } else {
          result += `<ruby class="ia-ruby ${pos}"${rubyPosAttr(pos)}>${escapeHtml(char)}<rp>(</rp><rt>${escapeHtml(ann)}</rt><rp>)</rp></ruby>`;
        }
      }
      return result;
    }
  }

  // --- Fallback: standard group ruby ---
  if (capped.length === 1) {
    const pos = op === "^^" ? "ia-ruby-over" : "ia-ruby-under";
    return `<ruby class="ia-ruby ${pos}"${rubyPosAttr(pos)}>${safeBase}<rp>(</rp><rt>${escapeHtml(capped[0])}</rt><rp>)</rp></ruby>`;
  }

  // Two levels group: nested <ruby> (Chromium doesn't support <rtc>)
  const innerPos = op === "^^" ? "ia-ruby-over" : "ia-ruby-under";
  const outerPos = op === "^^" ? "ia-ruby-under" : "ia-ruby-over";
  return (
    `<ruby class="ia-ruby ${outerPos} ia-ruby-double"${rubyPosAttr(outerPos)}>` +
    `<ruby class="ia-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${safeBase}<rp>(</rp><rt>${escapeHtml(capped[0])}</rt><rp>)</rp></ruby>` +
    `<rp>(</rp><rt>${escapeHtml(capped[1])}</rt><rp>)</rp></ruby>`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function hasRuby(text: string): boolean {
  return hasInlineAnnotation(text);
}

/** True if the string contains rendered Inline Annotation HTML (ruby, bouten, or underline). */
function hasAnnotationHtml(text: string): boolean {
  return /<ruby\b/i.test(text) || GENERATED_ANNOTATION_HTML_RE.test(text);
}

export function hasAnyRubyContent(text: string): boolean {
  return hasRuby(text) || hasAnnotationHtml(text) || text.includes("{{renderer :ruby");
}

const MACRO_RE = /\{\{renderer\s+:ruby,\s*([^,}]+),\s*([^,}]+)(?:,\s*([^}]+))?\}\}/g;

/** Convert annotation source while preserving surrounding Logseq markup verbatim. */
export function rubyToHTML(input: string): string {
  if (!hasRuby(input)) return input;
  let html = "";
  let end = 0;
  for (const model of findInlineAnnotationModels(input)) {
    if (!model.base.raw) continue;
    html += input.slice(end, model.start) + renderInlineAnnotationModelToHtml(model);
    end = model.end;
  }
  return html + input.slice(end);
}

// Source conversion

function macrosToMarkup(content: string): string {
  return content.replace(MACRO_RE, (match: string, base: string, ann: string, pos?: string) => {
    const b = base.trim();
    const a = ann.trim();
    if (!b || !a || /[\r\n]/.test(b) || /[\r\n]/.test(a)) return match;
    const op = pos?.trim().toLowerCase() === "under" ? "^_" : "^^";
    const slots = splitByUnescapedPipe(a);
    const annotation = slots.map((raw) => convertAnnotationSlot(raw, escapeMarkupAnnotation, slots.length === 1)).join("|");
    return "[" + escapeMarkupBase(b) + "]" + op + "(" + annotation + ")";
  });
}

function modelToMacro(model: InlineAnnotationModel): string | undefined {
  const base = unescape(model.base.raw);
  const slots = model.slots.map((slot) => slot.raw);
  // The legacy macro cannot encode nested bases, overflow, or mixed marks.
  if (!base || findInlineAnnotationModels(model.base.raw).length || model.overflow.length ||
      (slots.length > 1 && slots.some(isDecorationPattern))) return;

  const annotation = slots.map((raw) => convertAnnotationSlot(raw, escapeMacroAnnotation, true)).join("|");
  if (!annotation.trim() || annotation !== annotation.trim() || base !== base.trim() ||
      /[,}\\]/.test(base) || /[,}]/.test(annotation)) return;

  const position = model.primaryOp === "^_" ? ", under" : "";
  return "{{renderer :ruby, " + base + ", " + annotation + position + "}}";
}

function markupToMacro(input: string): string {
  let output = "";
  let end = 0;
  for (const model of findInlineAnnotationModels(input)) {
    const macro = modelToMacro(model);
    if (!macro) continue;
    output += input.slice(end, model.start) + macro;
    end = model.end;
  }
  return output + input.slice(end);
}

function sourceToHtml(input: string): string {
  let result = "";
  let end = 0;
  for (const match of input.matchAll(MACRO_RE)) {
    const [raw, base, ann, pos] = match;
    result += rubyToHTML(input.slice(end, match.index));
    result += renderMacroRuby([":ruby", base, ann, pos]) ?? raw;
    end = match.index + raw.length;
  }
  return result + rubyToHTML(input.slice(end));
}

interface MarkSlot {
  op: RubyOp;
  pattern: string;
}

function markSlots(element: Element): MarkSlot[] {
  const slots: MarkSlot[] = [];
  const underBouten = element.classList.contains("ia-bouten-under");
  if (element.classList.contains("ia-bouten-over") || (element.classList.contains("ia-bouten") && !underBouten)) {
    slots.push({ op: "^^", pattern: BOUTEN_PATTERN });
  }
  if (underBouten) slots.push({ op: "^_", pattern: BOUTEN_PATTERN });
  const over = overlinePatternFromClasses(element);
  const under = underlinePatternFromClasses(element);
  if (over) slots.push({ op: "^^", pattern: over });
  if (under) slots.push({ op: "^_", pattern: under });
  return slots;
}

function markSuffix(slots: MarkSlot[]): string {
  return slots.map(({ op, pattern }) => op + "(" + pattern + ")").join("");
}

const readingTags = new Set(["RT", "RP", "RTC"]);

function rubyBase(ruby: Element, inner?: Element): string | undefined {
  let base = "";
  for (const child of Array.from(ruby.childNodes)) {
    if (child === inner) continue;
    if (child.nodeType === child.TEXT_NODE) {
      base += child.textContent ?? "";
    } else if (child.nodeType === child.ELEMENT_NODE) {
      const element = child as Element;
      if (readingTags.has(element.tagName)) continue;
      if (element.tagName !== "RB" || element.childElementCount > 0) return;
      base += element.textContent ?? "";
    }
  }
  return base;
}

function rubyReadings(ruby: Element): string[] {
  return Array.from(ruby.children)
    .filter((child) => child.tagName === "RT" || child.tagName === "RTC")
    .map((child) => child.textContent ?? "")
    .filter((level) => level.trim());
}

function rubyMarkup(ruby: Element): string | undefined {
  const inner = firstDirectChildByTag(ruby, "ruby");
  const readings = rubyReadings(ruby);
  if (inner) {
    // The macro and two-slot source can express a grouped pair. Leave
    // partially overlapping or otherwise structured HTML in its own form.
    const innerReadings = rubyReadings(inner);
    const base = rubyBase(inner);
    if (!base?.trim() || rubyBase(ruby, inner)?.trim() !== "" || innerReadings.length !== 1 || readings.length !== 1) return;
    const op = inner.classList.contains("ia-ruby-over") ? "^^" : "^_";
    return formatRubyMarkupLevels(base, op, [innerReadings[0], readings[0]]);
  }

  const base = rubyBase(ruby);
  if (!base?.trim() || !readings.length || readings.length > 2) return;
  const op = ruby.classList.contains("ia-ruby-under") ? "^_" : "^^";
  const marks = ruby.classList.contains("ia-ruby-mixed") ? markSlots(ruby) : [];
  if (readings.length + marks.length > 2 || marks.some((mark) => mark.op === op)) return;
  return formatRubyMarkupLevels(base, op, readings) + markSuffix(marks);
}

function spanMarkup(span: Element): string | undefined {
  const marks = markSlots(span);
  let innermost = span;
  while (innermost.childNodes.length === 1 && innermost.firstElementChild?.tagName === "SPAN") {
    innermost = innermost.firstElementChild;
    const nestedMarks = markSlots(innermost);
    if (!nestedMarks.length) return;
    marks.push(...nestedMarks);
    if (marks.length > 2) return;
  }
  const base = innermost.textContent ?? "";
  if (innermost.childElementCount || !base.trim() || !marks.length ||
      new Set(marks.map((mark) => mark.op)).size !== marks.length) return;
  return "[" + escapeMarkupBase(base) + "]" + markSuffix(marks);
}

function convertHtmlAndProse(
  source: string,
  convertProse: (text: string) => string,
  convertMarkup?: (markup: string, model: InlineAnnotationModel) => string | undefined,
): string {
  if (!source.includes("<")) return convertProse(source);
  let parser: DOMParser | undefined;
  let output = "";
  let end = 0;
  for (const range of conversionHtmlRanges(source)) {
    const raw = source.slice(range.start, range.end);
    let replacement: string | undefined;
    if (range.annotation && convertMarkup) {
      parser ??= new DOMParser();
      const element = parser.parseFromString(raw, "text/html").body.firstElementChild;
      if (element) {
        const markup = element.tagName === "RUBY" ? rubyMarkup(element) : spanMarkup(element);
        if (markup) {
          const model = findInlineAnnotationModel(markup);
          if (model?.start === 0 && model.end === markup.length) replacement = convertMarkup(markup, model);
        }
      }
    }
    output += convertProse(source.slice(end, range.start)) + (replacement ?? raw);
    end = range.end;
  }
  return output + convertProse(source.slice(end));
}

export function rubyHtmlToMarkup(html: string): string {
  return convertHtmlAndProse(html, (text) => text, (markup) => markup);
}

export function anyToMarkup(content: string): string {
  return convertOutsideCode(content, (prose) => convertHtmlAndProse(prose, macrosToMarkup, (markup) => markup));
}

export function anyToMacro(content: string): string {
  return convertOutsideCode(content, (prose) => convertHtmlAndProse(prose, markupToMacro, (_, model) => modelToMacro(model)));
}

export function anyToHTML(content: string): string {
  return convertOutsideCode(content, (prose) => convertHtmlAndProse(prose, sourceToHtml));
}

// ---------------------------------------------------------------------------
// Macro renderer helper
// ---------------------------------------------------------------------------

export function renderMacroRuby(args: string[]): string | null {
  if (args.length < 3) return null;
  const base = args[1]?.trim();
  const rawAnn = args[2]?.trim();
  if (!base || !rawAnn) return null;

  const posArg = (args[3] ?? "").trim().toLowerCase();
  const position = posArg === "under" ? "under" : "over";
  const op: RubyOp = position === "under" ? "^_" : "^^";
  const slot = classifyInlineAnnotationSlot(rawAnn, position);
  if (slot.kind === "bouten") return renderBouten(base, op);
  if (slot.kind === "line") return renderLine(base, op, slot.style);

  const levels = splitByUnescapedPipe(rawAnn).map(unescape);
  return renderRuby(base, op, levels);
}
