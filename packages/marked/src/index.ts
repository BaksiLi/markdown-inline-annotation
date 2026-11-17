import type { MarkedExtension } from "marked";
import {
  findInlineAnnotationModelBeforeMarkdown,
  renderInlineAnnotationModelToHtml,
  type InlineAnnotationOptions,
} from "markdown-it-inline-annotation/core";

// Reserve Markdown punctuation for the host. Brackets accept the full v2 base grammar.
const starts = /\[|[\p{L}\p{M}\p{N}\p{So}.'’-]+/gu;
const wordAtStart = /^[\p{L}\p{M}\p{N}\p{So}.'’-]+(?=\^(?:\^|_)\()/u;

function* candidates(source: string, abbreviated: boolean) {
  if (!source.includes("^^(") && !source.includes("^_(")) return;
  for (const match of source.matchAll(starts)) {
    if (match[0] === "[") {
      yield match.index;
      continue;
    }
    const end = match.index + match[0].length;
    if (abbreviated && (source.startsWith("^^(", end) || source.startsWith("^_(", end))) {
      yield match.index;
    }
  }
}

export default function markedInlineAnnotation(options: InlineAnnotationOptions = {}): MarkedExtension {
  const abbreviated = options.enableAbbreviated !== false;
  return {
    hooks: {
      // Keep a delimiter inside a slot from closing emphasis around the annotation.
      emStrongMask(source) {
        if (!/[*_~]/.test(source)) return source;
        let masked = "";
        let end = 0;
        for (const start of candidates(source, abbreviated)) {
          if (start < end) continue;
          const model = findInlineAnnotationModelBeforeMarkdown(source, start, source.length, options);
          if (!model || model.start !== start) continue;
          masked += source.slice(end, start) + "a".repeat(model.end - start);
          end = model.end;
        }
        return masked + source.slice(end);
      },
    },
    extensions: [{
      name: "inlineAnnotation",
      level: "inline",
      start(source) {
        if (this.lexer.state.inLink || this.lexer.state.inRawBlock) return;
        return candidates(source, abbreviated).next().value;
      },
      tokenizer(source) {
        if (this.lexer.state.inLink || this.lexer.state.inRawBlock) return;
        if (/^www\./i.test(source)) return;
        if (source[0] !== "[" && !(abbreviated && wordAtStart.test(source))) return;
        const model = findInlineAnnotationModelBeforeMarkdown(source, 0, source.length, options);
        if (model?.start !== 0) return;
        return { type: "inlineAnnotation", raw: model.source, model };
      },
      renderer(token) {
        return renderInlineAnnotationModelToHtml(token.model, options);
      },
    }],
  };
}
