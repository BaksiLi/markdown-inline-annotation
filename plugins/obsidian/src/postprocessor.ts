import { findInlineAnnotationModels, hasInlineAnnotation, type InlineAnnotationModel } from "markdown-it-inline-annotation/core";
import { excludeModelsStartingInReferences, projectMarkdownText, type CharacterReference } from "./markdown-source";
import { renderAnnotation } from "./render-dom";
import { OBSIDIAN_RENDER_OPTIONS } from "./render-options";

const SKIP_TAGS = new Set(["A", "CODE", "PRE", "RUBY", "SCRIPT", "STYLE", "TEXTAREA"]);

export interface InlineAnnotationRenderStats {
  replacements: number;
}

function isSkipped(element: Element): boolean {
  return SKIP_TAGS.has(element.tagName) || element.hasAttribute("data-inline-annotation-ignore");
}

function isTransparent(element: Element): boolean {
  return element.tagName === "SPAN" && element.attributes.length === 0;
}

function findModels(source: string) {
  return findInlineAnnotationModels(source, 0, source.length, OBSIDIAN_RENDER_OPTIONS);
}

function renderSource(
  source: string,
  models: InlineAnnotationModel[],
  document: Document,
  decodeText: (source: string) => string = (text) => text,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let end = 0;
  for (const model of models) {
    if (end < model.start) fragment.append(decodeText(source.slice(end, model.start)));
    fragment.append(renderAnnotation(model, document));
    end = model.end;
  }
  if (end < source.length) fragment.append(decodeText(source.slice(end)));
  return fragment;
}

function replaceTextNode(node: Text): ChildNode[] | null {
  const source = node.data;
  const models = findModels(source);
  if (!models.length) return null;

  const fragment = renderSource(source, models, node.ownerDocument);
  const rendered = Array.from(fragment.childNodes);
  node.replaceWith(fragment);
  return rendered;
}

function renderSourceParagraph(root: HTMLElement, source: string): number | undefined {
  const paragraph = root.tagName === "P" ? root : root.firstElementChild;
  if (paragraph?.tagName !== "P" || paragraph.childElementCount > 0 || isSkipped(paragraph)) return;
  if (paragraph !== root && (root.childNodes.length !== 1 || root.firstChild !== paragraph)) return;

  // Match the source projection exactly before using it to interpret a plain
  // paragraph. Rich inline markup stays on the DOM path to preserve its owners.
  const raw = source.trim();
  const document = paragraph.ownerDocument;
  const references: CharacterReference[] = [];
  const text = projectMarkdownText(raw, references);
  if (text === raw || text !== paragraph.textContent) return;
  const models = excludeModelsStartingInReferences(findModels(raw), references);
  if (!models.length) return 0;
  paragraph.replaceChildren(renderSource(raw, models, document, projectMarkdownText));
  return 1;
}

interface TextRun {
  node: Text;
  start: number;
  end: number;
}

function replaceFragmentedAnnotations(nodes: Text[]): number {
  if (nodes.length < 2) return 0;
  const runs: TextRun[] = [];
  let source = "";
  for (const node of nodes) {
    const start = source.length;
    source += node.data;
    runs.push({ node, start, end: source.length });
  }

  const matches = [];
  let first = 0;
  let last = 0;
  for (const model of findModels(source)) {
    while (runs[first].end <= model.start) first++;
    last = Math.max(last, first);
    while (runs[last].end < model.end) last++;
    if (first !== last) matches.push({ model, start: runs[first], end: runs[last] });
  }

  // Applying ranges right to left keeps the preceding text offsets valid.
  const document = nodes[0].ownerDocument;
  for (const { model, start, end } of matches.reverse()) {
    const range = document.createRange();
    range.setStart(start.node, model.start - start.start);
    range.setEnd(end.node, model.end - end.start);
    range.deleteContents();
    range.insertNode(renderAnnotation(model, document));
  }
  return matches.length;
}

function renderContainer(container: Element): number {
  if (isSkipped(container)) return 0;

  let replacements = 0;
  let runs: Text[] = [];
  function flush(): void {
    replacements += replaceFragmentedAnnotations(runs);
    runs = [];
  }

  function visit(node: Node): void {
    if (node.nodeType === node.TEXT_NODE) {
      const text = node as Text;
      if (!text.length) return;
      // Existing complete expressions in one text node take precedence.
      const rendered = hasInlineAnnotation(text.data) ? replaceTextNode(text) : null;
      if (!rendered) {
        runs.push(text);
        return;
      }
      replacements++;
      for (const child of rendered) {
        if (child.nodeType === child.TEXT_NODE) runs.push(child as Text);
        else flush();
      }
    } else if (node.nodeType === node.ELEMENT_NODE) {
      const element = node as Element;
      if (isTransparent(element)) {
        for (const child of Array.from(element.childNodes)) visit(child);
      } else {
        flush();
        replacements += renderContainer(element);
      }
    }
  }

  for (const child of Array.from(container.childNodes)) visit(child);
  flush();
  return replacements;
}

export function renderInlineAnnotationsInElement(root: HTMLElement, sectionSource?: string): InlineAnnotationRenderStats {
  if (sectionSource && !isSkipped(root)) {
    const replacements = renderSourceParagraph(root, sectionSource);
    if (replacements !== undefined) return { replacements };
  }
  return { replacements: renderContainer(root) };
}
