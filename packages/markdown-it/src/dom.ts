import type { InlineAnnotationModel, InlineAnnotationOptions } from "./model.js";
import { resolveOptions } from "./options.js";
import { AnnotationRenderer, type RenderOutput } from "./render.js";

export type InlineAnnotationElementFactory = (
  parent: HTMLElement | DocumentFragment,
  tag: "ruby" | "span" | "rp" | "rt",
  classes: string,
  text?: string,
) => HTMLElement;

const createDomElement: InlineAnnotationElementFactory = (parent, tag, classes, text) => {
  const element = parent.ownerDocument.createElement(tag);
  if (classes) element.className = classes;
  if (text) element.textContent = text;
  parent.append(element);
  return element;
};

export function renderInlineAnnotationModelToFragment(
  model: InlineAnnotationModel,
  document: Document,
  options?: InlineAnnotationOptions,
  createElement: InlineAnnotationElementFactory = createDomElement,
): DocumentFragment {
  const output: RenderOutput<Node> = {
    text: (value) => document.createTextNode(value),
    join(parts) {
      const fragment = document.createDocumentFragment();
      for (const part of parts) fragment.append(part);
      return fragment;
    },
    span(base, classes, style) {
      const element = createElement(document.createDocumentFragment(), "span", classes);
      if (style) element.setAttribute("style", style);
      element.append(base);
      return element;
    },
    ruby(base, annotation, classes, style, open, close) {
      const element = createElement(document.createDocumentFragment(), "ruby", classes);
      if (style) element.setAttribute("style", style);
      element.append(base);
      createElement(element, "rp", "", open);
      createElement(element, "rt", "", annotation);
      createElement(element, "rp", "", close);
      return element;
    },
  };

  const rendered = new AnnotationRenderer(output, resolveOptions(options)).model(model);
  const fragment = document.createDocumentFragment();
  fragment.append(rendered);
  return fragment;
}
