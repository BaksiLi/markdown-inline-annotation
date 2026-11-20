import type { InlineAnnotationModel } from "markdown-it-inline-annotation/core";
import { renderInlineAnnotationModelToFragment } from "markdown-it-inline-annotation/dom";
import { OBSIDIAN_RENDER_OPTIONS } from "./render-options";

export function renderAnnotation(model: InlineAnnotationModel, document: Document): DocumentFragment {
  return renderInlineAnnotationModelToFragment(
    model,
    document,
    OBSIDIAN_RENDER_OPTIONS,
    (parent, tag, classes, text) => parent.createEl(tag, { cls: classes, text }),
  );
}
