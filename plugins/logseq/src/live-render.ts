import { findInlineAnnotationModels, hasInlineAnnotation } from "markdown-it-inline-annotation/core";
import { renderInlineAnnotationModelToFragment } from "markdown-it-inline-annotation/dom";

const BLOCK_SELECTOR = "div.block-content";
const HOST_TAGS = new Set(["A", "CODE", "PRE", "RUBY", "SCRIPT", "STYLE", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

type Restore = (changedText?: ReadonlySet<Text>) => void;

function isHostContent(element: Element): boolean {
  if (HOST_TAGS.has(element.tagName)) return true;
  const editable = element.getAttribute("contenteditable");
  return editable !== null && editable.toLowerCase() !== "false";
}

function collectTextRuns(root: HTMLElement): Text[][] {
  const runs: Text[][] = [];
  let run: Text[] = [];

  function endRun() {
    if (run.length) runs.push(run);
    run = [];
  }

  function walk(element: Element) {
    for (const node of element.childNodes) {
      if (node.nodeType === node.TEXT_NODE) {
        if ((node as Text).length) run.push(node as Text);
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const child = node as Element;
        if (child.tagName === "SPAN" && child.attributes.length === 0) {
          walk(child);
        } else {
          endRun();
          if (!isHostContent(child) && !(child.tagName === "DIV" && child.matches(BLOCK_SELECTOR))) walk(child);
          endRun();
        }
      }
    }
  }

  walk(root);
  endRun();
  return runs;
}

/** Render alongside the host text so React can still update or remove its own nodes. */
export function decorateRubyInElement(root: HTMLElement): Restore | undefined {
  if (!hasInlineAnnotation(root.textContent ?? "") || isHostContent(root)) return;

  const doc = root.ownerDocument;
  const restoreRuns: Restore[] = [];
  for (const nodes of collectTextRuns(root)) {
    const parts = nodes.map((node) => node.data);
    const source = parts.length === 1 ? parts[0] : parts.join("");
    const models = findInlineAnnotationModels(source).filter((model) => model.base.raw);
    if (!models.length) continue;

    // Preserve the leading and trailing host nodes outside the annotated range.
    let first = 0;
    let firstOffset = 0;
    const start = models[0].start;
    while (firstOffset + parts[first].length <= start) {
      firstOffset += parts[first].length;
      first++;
    }
    const prefix = parts[first].slice(0, start - firstOffset);
    let last = parts.length - 1;
    let lastOffset = source.length;
    const lastEnd = models[models.length - 1].end;
    while (lastOffset - parts[last].length >= lastEnd) {
      lastOffset -= parts[last].length;
      last--;
    }

    const fragment = doc.createDocumentFragment();
    let end = start;
    for (const model of models) {
      if (model.start > end) fragment.append(source.slice(end, model.start));
      fragment.append(renderInlineAnnotationModelToFragment(model, doc));
      end = model.end;
    }
    if (end < lastOffset) fragment.append(source.slice(end, lastOffset));

    const renderedNodes = Array.from(fragment.childNodes);
    nodes[first].after(fragment);
    for (let index = first; index <= last; index++) {
      nodes[index].data = index === first ? prefix : "";
    }
    restoreRuns.push((changedText) => {
      for (const node of renderedNodes) node.remove();
      for (let index = first; index <= last; index++) {
        const node = nodes[index];
        const shortened = index === first ? prefix : "";
        // A host write can match the temporary value and still supersede the source.
        if (node.data === shortened && !changedText?.has(node)) node.data = parts[index];
      }
    });
  }

  if (restoreRuns.length) {
    return (changedText) => {
      for (const restore of restoreRuns) restore(changedText);
    };
  }
}

export function observeRubyBlocks(root: HTMLElement): () => void {
  const decorations = new Map<HTMLElement, Restore>();

  function refresh(block: HTMLElement, changedText?: ReadonlySet<Text>) {
    decorations.get(block)?.(changedText);
    decorations.delete(block);
    if (!root.contains(block)) return;
    const restore = decorateRubyInElement(block);
    if (restore) decorations.set(block, restore);
  }

  for (const block of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) refresh(block);

  const observer = new MutationObserver((mutations) => {
    const blocks = new Set<HTMLElement>();
    const changedText = new Set<Text>();
    for (const mutation of mutations) {
      const target = mutation.target;
      const element = target.nodeType === target.ELEMENT_NODE ? target as Element : target.parentElement;
      const block = element?.closest<HTMLElement>(BLOCK_SELECTOR);
      if (block) blocks.add(block);
      if (mutation.type === "characterData" && target.nodeType === target.TEXT_NODE) {
        changedText.add(target as Text);
        continue;
      }
      for (const nodes of [mutation.addedNodes, mutation.removedNodes]) {
        for (const node of nodes) {
          if (node.nodeType !== node.ELEMENT_NODE) continue;
          const child = node as HTMLElement;
          if (child.matches(BLOCK_SELECTOR)) blocks.add(child);
          for (const descendant of child.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) blocks.add(descendant);
        }
      }
    }
    for (const block of blocks) refresh(block, changedText);
    observer.takeRecords(); // Skip the mutations generated by this render pass.
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });

  return () => {
    // Apply any final host edits before restoring the remaining source.
    const changedText = new Set<Text>();
    for (const { type, target } of observer.takeRecords()) {
      if (type === "characterData" && target.nodeType === target.TEXT_NODE) changedText.add(target as Text);
    }
    observer.disconnect();
    for (const restore of decorations.values()) restore(changedText);
    decorations.clear();
  };
}
