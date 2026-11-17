import type MarkdownIt from "markdown-it";
import inlineAnnotationPlugin from "markdown-it-inline-annotation";

export function activate() {
  return {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt {
      return md.use(inlineAnnotationPlugin);
    },
  };
}

export function deactivate() {}
