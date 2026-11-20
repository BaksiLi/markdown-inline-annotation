import type { InlineAnnotationModel, InlineAnnotationOptions } from "./model.js";
import { resolveOptions } from "./options.js";
import { AnnotationRenderer, type RenderOutput } from "./render.js";

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => entities[character]);
}

function styleAttribute(style: string): string {
  return style ? ` style="${style}"` : "";
}

const html: RenderOutput<string> = {
  text: escapeHtml,
  join: (parts) => parts.join(""),
  span(base, classes, style) {
    return `<span class="${escapeHtml(classes)}"${styleAttribute(style)}>${base}</span>`;
  },
  ruby(base, annotation, classes, style, open, close) {
    return `<ruby class="${escapeHtml(classes)}"${styleAttribute(style)}>${base}<rp>${escapeHtml(open)}</rp><rt>${escapeHtml(annotation)}</rt><rp>${escapeHtml(close)}</rp></ruby>`;
  },
};

export function renderInlineAnnotationModelToHtml(model: InlineAnnotationModel, options?: InlineAnnotationOptions): string {
  return new AnnotationRenderer(html, resolveOptions(options)).model(model);
}

export function renderInlineAnnotationsToHtml(source: string, options?: InlineAnnotationOptions): string {
  return new AnnotationRenderer(html, resolveOptions(options)).source(source);
}
