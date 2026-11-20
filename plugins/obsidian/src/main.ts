import { hasInlineAnnotation } from "markdown-it-inline-annotation/core";
import { Plugin } from "obsidian";
import { inlineAnnotationLivePreviewExtension } from "./live-preview";
import { renderInlineAnnotationsInElement } from "./postprocessor";

export default class InlineAnnotationPlugin extends Plugin {
  onload() {
    let currentSource: { text: string; lines: string[] | null } | undefined;
    this.registerMarkdownPostProcessor((element, context) => {
      if (!hasInlineAnnotation(element.textContent ?? "")) return;
      const info = context.getSectionInfo(element);
      let sectionSource: string | undefined;
      if (info) {
        if (currentSource?.text !== info.text) {
          currentSource = {
            text: info.text,
            lines: /[\\&]/.test(info.text) ? info.text.split(/\r?\n/) : null,
          };
        }
        sectionSource = currentSource.lines?.slice(info.lineStart, info.lineEnd + 1).join("\n");
      }
      renderInlineAnnotationsInElement(element, sectionSource);
    });
    this.registerEditorExtension(inlineAnnotationLivePreviewExtension());
  }
}
