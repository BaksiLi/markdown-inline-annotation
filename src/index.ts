import {
  findInlineAnnotationModels,
  renderInlineAnnotationModelToHtml,
  type InlineAnnotationOptions,
} from "markdown-it-inline-annotation/core";
import type {
  HastContent,
  HastPluginDefinition,
  HastVisitorContext,
  MdastNode,
  MdastPluginDefinition,
  MdastVisitorContext,
} from "satteri";

const MARKER_END = "\uE001";
const INITIAL_MARKER_PREFIX = "\uE000INLINEANNOTATION";

const HOST_OWNED_NODE_TYPES = new Set([
  "inlineCode",
  "link",
  "linkReference",
  "image",
  "imageReference",
  "html",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
  "mdxFlowExpression",
  "mdxTextExpression",
  "mdxjsEsm",
]);

const VOID_HTML_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

interface SourceRange {
  start: number;
  end: number;
}

interface HtmlToken extends SourceRange {
  value: string;
}

interface CompileState {
  markerPrefix: string;
  nextMarkerId: number;
  htmlByMarker: Map<string, string>;
}

export interface SatteriInlineAnnotationPreset {
  mdastPlugins: MdastPluginDefinition[];
  hastPlugins: HastPluginDefinition[];
}

function childrenOf(node: Readonly<MdastNode>): readonly MdastNode[] {
  if (!("children" in node) || !Array.isArray(node.children)) return [];
  return node.children as readonly MdastNode[];
}

function sourceRangeOf(node: Readonly<MdastNode>): SourceRange | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;
  return { start, end };
}

function collectHostOwnedRanges(
  node: Readonly<MdastNode>,
  ranges: SourceRange[],
  htmlTokens: HtmlToken[]
): void {
  for (const child of childrenOf(node)) {
    const range = sourceRangeOf(child);
    if (range && HOST_OWNED_NODE_TYPES.has(child.type)) {
      ranges.push(range);
      if (child.type === "html") htmlTokens.push({ ...range, value: child.value });
    }
    collectHostOwnedRanges(child, ranges, htmlTokens);
  }
}

function collectRawHtmlIslands(tokens: HtmlToken[]): SourceRange[] {
  const islands: SourceRange[] = [];
  const stack: Array<{ tag: string; start: number }> = [];

  for (const token of [...tokens].sort((a, b) => a.start - b.start)) {
    const value = token.value.trim();
    const closing = /^<\/([A-Za-z][A-Za-z0-9:-]*)\s*>$/.exec(value);
    if (closing) {
      const tag = closing[1].toLowerCase();
      let openIndex = -1;
      for (let index = stack.length - 1; index >= 0; index--) {
        if (stack[index].tag === tag) {
          openIndex = index;
          break;
        }
      }
      if (openIndex >= 0) {
        const [open] = stack.splice(openIndex, 1);
        islands.push({ start: open.start, end: token.end });
      }
      continue;
    }

    const opening = /^<([A-Za-z][A-Za-z0-9:-]*)\b[\s\S]*>$/.exec(value);
    if (!opening || value.endsWith("/>")) continue;
    const tag = opening[1].toLowerCase();
    if (!VOID_HTML_ELEMENTS.has(tag)) stack.push({ tag, start: token.start });
  }

  return islands;
}

function overlaps(left: SourceRange, right: SourceRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function isBlockedByHostRange(model: SourceRange, hostRange: SourceRange): boolean {
  if (!overlaps(model, hostRange)) return false;

  // Source-first Inline Annotation owns markup-looking characters inside its
  // own fields. A surrounding or partially crossed host construct still owns
  // the source and must be preserved.
  const modelContainsHostRange = model.start <= hostRange.start && hostRange.end <= model.end;
  return !modelContainsHostRange;
}

function createCompileState(source: string): CompileState {
  let markerPrefix = INITIAL_MARKER_PREFIX;
  while (source.includes(markerPrefix)) markerPrefix = `\uE000${markerPrefix}`;
  return {
    markerPrefix,
    nextMarkerId: 0,
    htmlByMarker: new Map(),
  };
}

function compileStateFor(
  context: MdastVisitorContext,
  stateKey: symbol
): CompileState {
  const data = context.data as unknown as Record<PropertyKey, unknown>;
  const existing = data[stateKey];
  if (existing) return existing as CompileState;
  const state = createCompileState(context.source);
  data[stateKey] = state;
  return state;
}

function issueMarker(state: CompileState, html: string): string {
  const marker = `${state.markerPrefix}${state.nextMarkerId++}${MARKER_END}`;
  state.htmlByMarker.set(marker, html);
  return marker;
}

function replaceAnnotationsInParent(
  node: Readonly<MdastNode>,
  context: MdastVisitorContext,
  options: InlineAnnotationOptions,
  stateKey: symbol
): { raw: string } | undefined {
  // Satteri 0.9 cannot mark inserted raw HTML as literal with respect to MDX
  // expressions. Preserve MDX until that contract can be made safe.
  if (context.sourceFormat !== "markdown") return undefined;

  const parentRange = sourceRangeOf(node);
  if (!parentRange) return undefined;

  const source = context.source.slice(parentRange.start, parentRange.end);
  const models = findInlineAnnotationModels(source, 0, source.length, options);
  if (models.length === 0) return undefined;

  const hostRanges: SourceRange[] = [];
  const htmlTokens: HtmlToken[] = [];
  collectHostOwnedRanges(node, hostRanges, htmlTokens);
  hostRanges.push(...collectRawHtmlIslands(htmlTokens));

  const state = compileStateFor(context, stateKey);
  let cursor = 0;
  let transformed = "";
  let replacements = 0;

  for (const model of models) {
    const absoluteRange = {
      start: parentRange.start + model.start,
      end: parentRange.start + model.end,
    };
    if (hostRanges.some((range) => isBlockedByHostRange(absoluteRange, range))) continue;

    transformed += source.slice(cursor, model.start);
    transformed += issueMarker(state, renderInlineAnnotationModelToHtml(model, options));
    cursor = model.end;
    replacements++;
  }

  if (replacements === 0) return undefined;
  transformed += source.slice(cursor);
  return { raw: transformed };
}

function stateFromHastContext(context: HastVisitorContext, stateKey: symbol): CompileState | undefined {
  const data = context.data as unknown as Record<PropertyKey, unknown>;
  return data[stateKey] as CompileState | undefined;
}

function restoreAnnotationsInText(
  node: Readonly<{ type: "text"; value: string }>,
  context: HastVisitorContext,
  stateKey: symbol
): void {
  const state = stateFromHastContext(context, stateKey);
  if (!state || !node.value.includes(state.markerPrefix)) return;

  const parts: HastContent[] = [];
  let cursor = 0;
  let replacements = 0;

  while (cursor < node.value.length) {
    const start = node.value.indexOf(state.markerPrefix, cursor);
    if (start < 0) break;
    const end = node.value.indexOf(MARKER_END, start + state.markerPrefix.length);
    if (end < 0) break;

    const markerEnd = end + MARKER_END.length;
    const marker = node.value.slice(start, markerEnd);
    const html = state.htmlByMarker.get(marker);
    if (html === undefined) {
      cursor = markerEnd;
      continue;
    }

    if (start > cursor) parts.push({ type: "text", value: node.value.slice(cursor, start) });
    parts.push({ type: "raw", value: html });
    cursor = markerEnd;
    replacements++;
  }

  if (replacements === 0) return;
  if (cursor < node.value.length) parts.push({ type: "text", value: node.value.slice(cursor) });
  context.insertBefore(node, parts);
  context.removeNode(node);
}

export function satteriInlineAnnotation(
  options: InlineAnnotationOptions = {}
): SatteriInlineAnnotationPreset {
  const stateKey = Symbol("satteri-inline-annotation");

  // Satteri 0.10 makes source positions opt-in. The option is harmless on the
  // 0.9 line used by the first consumer, whose type surface predates it.
  const mdastPlugin = {
    name: "inline-annotation-source",
    options: { position: true },
    paragraph(node, context) {
      return replaceAnnotationsInParent(node, context, options, stateKey);
    },
    heading(node, context) {
      return replaceAnnotationsInParent(node, context, options, stateKey);
    },
  } as MdastPluginDefinition;

  const hastPlugin: HastPluginDefinition = {
    name: "inline-annotation-render",
    text(node, context) {
      restoreAnnotationsInText(node, context, stateKey);
    },
  };

  return {
    mdastPlugins: [mdastPlugin],
    hastPlugins: [hastPlugin],
  };
}

export default satteriInlineAnnotation;
export type { InlineAnnotationOptions } from "markdown-it-inline-annotation/core";
