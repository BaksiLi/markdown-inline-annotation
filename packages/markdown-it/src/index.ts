import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline";
import {
  hasInlineAnnotation,
  renderInlineAnnotationModelToHtml,
  type InlineAnnotationOptions,
} from "./core.js";
import { abbreviatedEnabled } from "./options.js";
import { AnnotationScanner } from "./parse.js";

export type MarkdownItInlineAnnotationOptions = InlineAnnotationOptions;

interface InlineScan {
  source: string;
  abbreviated: boolean;
  scanner: AnnotationScanner | null;
  readTokens: number;
  linkDepth: number;
  literalHtml: string[];
  links?: ReturnType<MarkdownIt["linkify"]["match"]>;
  nextLink: number;
}

const literalHtmlTag = /^<(\/?)(a|code|pre|script|style|textarea|ruby)(?=[\s/>])/i;

function insideHostTokens(state: StateInline, scan: InlineScan): boolean {
  while (scan.readTokens < state.tokens.length) {
    const token = state.tokens[scan.readTokens++];
    if (token.type === "link_open" || token.type === "link_close") scan.linkDepth += token.nesting;
    if (token.type !== "html_inline" || token.meta?.inlineAnnotationSource !== undefined) continue;
    const tag = literalHtmlTag.exec(token.content);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (tag[1]) {
      if (scan.literalHtml[scan.literalHtml.length - 1] === name) scan.literalHtml.pop();
    } else if (!token.content.endsWith("/>")) {
      scan.literalHtml.push(name);
    }
  }
  return scan.linkDepth > 0 || scan.literalHtml.length > 0;
}

function insideAutolink(state: StateInline, scan: InlineScan, start: number): boolean {
  if (scan.links === undefined) scan.links = state.md.linkify.match(scan.source);
  if (!scan.links) return false;
  while (scan.links[scan.nextLink]?.lastIndex <= start) scan.nextLink++;
  const link = scan.links[scan.nextLink];
  return link !== undefined && link.index <= start;
}

function containsAnnotation(tokens: MarkdownIt.Token[]): boolean {
  return tokens.some((token) => token.meta?.inlineAnnotationSource !== undefined ||
    (token.children !== null && containsAnnotation(token.children)));
}

export function inlineAnnotationPlugin(md: MarkdownIt, options: MarkdownItInlineAnnotationOptions = {}): void {
  const scans = new WeakMap<StateInline, InlineScan>();
  let plainImageLabel = false;

  md.inline.ruler.before("text", "inline_annotation", (state: StateInline, silent: boolean): boolean => {
    // During validation, the link parser interprets a consumed '[' as a
    // nested link. Leave its label and destination grammar to markdown-it.
    if (silent || plainImageLabel) return false;
    const abbreviated = abbreviatedEnabled(options);
    const source = state.src;
    let scan = scans.get(state);
    if (!scan || scan.source !== source || scan.abbreviated !== abbreviated) {
      scan = {
        source,
        abbreviated,
        scanner: hasInlineAnnotation(source) ? new AnnotationScanner(source, source.length, abbreviated, true) : null,
        readTokens: 0,
        linkDepth: 0,
        literalHtml: [],
        nextLink: 0,
      };
      scans.set(state, scan);
    }
    if (!scan.scanner) return false;
    if (insideHostTokens(state, scan)) return false;

    const match = scan.scanner.find(state.pos, state.posMax);
    if (!match) return false;
    if (match.form === "abbreviated" && state.md.options.linkify && insideAutolink(state, scan, match.start)) return false;

    state.pending += source.slice(state.pos, match.start);
    const token = state.push("html_inline", "", 0);
    token.content = renderInlineAnnotationModelToHtml(match, options);
    token.meta = { inlineAnnotationSource: match.source };
    state.pos = match.end;
    return true;
  });

  md.core.ruler.after("inline", "inline_annotation_image_alt", ({ tokens, env }) => {
    for (const block of tokens) {
      for (const token of block.children ?? []) {
        if (token.type !== "image" || !token.children || !containsAnnotation(token.children)) continue;
        // markdown-it parses the label as an independent inline state. Reuse
        // its plain-label parsing before it derives the alt attribute.
        const children: MarkdownIt.Token[] = [];
        plainImageLabel = true;
        try {
          md.inline.parse(token.content, md, env, children);
        } finally {
          plainImageLabel = false;
        }
        token.children = children;
      }
    }
  });
}

export default inlineAnnotationPlugin;
export { inlineAnnotationPlugin as plugin };
export * from "./core.js";
