import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline";
import {
  findInlineAnnotationBeforeMarkdown,
  type InlineAnnotationOptions,
} from "./core";

export type MarkdownItInlineAnnotationOptions = InlineAnnotationOptions;

function pushText(state: StateInline, content: string): void {
  if (!content) return;
  const token = state.push("text", "", 0);
  token.content = content;
}

function createInlineAnnotationRule(options: InlineAnnotationOptions) {
  return function inlineAnnotationRule(state: StateInline, silent: boolean): boolean {
    const match = findInlineAnnotationBeforeMarkdown(state.src, state.pos, state.posMax, options);
    if (!match) return false;
    if (silent && match.start !== state.pos) return false;

    if (!silent) {
      pushText(state, state.src.slice(state.pos, match.start));
      const token = state.push("html_inline", "", 0);
      token.content = match.html;
      token.meta = { inlineAnnotationSource: match.source };
    }

    state.pos = match.end;
    return true;
  };
}

export function inlineAnnotationPlugin(md: MarkdownIt, options?: MarkdownItInlineAnnotationOptions): void {
  md.inline.ruler.before("text", "inline_annotation", createInlineAnnotationRule(options ?? {}));
}

export default inlineAnnotationPlugin;
export { inlineAnnotationPlugin as plugin };
export {
  findInlineAnnotation,
  findInlineAnnotationBeforeMarkdown,
  findInlineAnnotationModel,
  findInlineAnnotationModelBeforeMarkdown,
  findInlineAnnotationModels,
  findInlineAnnotationModelsBeforeMarkdown,
  hasInlineAnnotation,
  inlineAnnotationDefaults,
  renderInlineAnnotationModelToHtml,
  renderInlineAnnotationsToHtml,
  type InlineAnnotationOptions,
  type InlineAnnotationMatch,
  type InlineAnnotationForm,
  type InlineAnnotationModel,
  type InlineAnnotationRange,
  type InlineAnnotationSlot,
  type InlineAnnotationSlotSource,
  type AnnotationOp,
  type AnnotationPosition,
  type SpaceAlignmentPolicy,
  type UnderlineStyle,
} from "./core";
