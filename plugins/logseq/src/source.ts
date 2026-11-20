export function isEscaped(input: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && input[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

interface SourceRange {
  start: number;
  end: number;
}

function* fencedCode(source: string): Iterable<SourceRange> {
  let opening: { start: number; marker: string } | undefined;
  for (const match of source.matchAll(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)(?:\r\n|[\r\n]|$)/gm)) {
    const [, marker, tail] = match;
    if (!opening) {
      if (marker[0] === "`" && tail.includes("`")) continue;
      opening = { start: match.index, marker };
    } else if (marker.startsWith(opening.marker) && /^[ \t]*$/.test(tail)) {
      yield { start: opening.start, end: match.index + match[0].length };
      opening = undefined;
    }
  }
  if (opening) yield { start: opening.start, end: source.length };
}

function* inlineCode(source: string): Iterable<SourceRange> {
  const tokens = Array.from(source.matchAll(/`+|(?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r(?!\n)|\n)/g));
  const nextByLength = new Map<number, SourceRange>();
  const closers = new Map<number, SourceRange>();
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { 0: token, index } = tokens[i];
    if (token[0] !== "`") {
      nextByLength.clear();
      continue;
    }
    const start = isEscaped(source, index) ? index + 1 : index;
    const end = index + token.length;
    const close = nextByLength.get(end - start);
    if (close) closers.set(index, { start, end: close.end });
    // Backslashes in code have no effect on a closing backtick run.
    nextByLength.set(token.length, { start: index, end });
  }

  let end = 0;
  for (const token of tokens) {
    if (token.index < end) continue;
    const range = closers.get(token.index);
    if (!range) continue;
    end = range.end;
    yield range;
  }
}

function mapProse(source: string, convert: (text: string) => string, ranges: Iterable<SourceRange>): string {
  let result = "";
  let end = 0;
  for (const code of ranges) {
    result += convert(source.slice(end, code.start)) + source.slice(code.start, code.end);
    end = code.end;
  }
  return result + convert(source.slice(end));
}

/** Convert only the prose surrounding matched code spans and fenced blocks. */
export function convertOutsideCode(source: string, convert: (text: string) => string): string {
  return mapProse(source, (text) => mapProse(text, convert, inlineCode(text)), fencedCode(source));
}

const annotationSpan = /\sclass\s*=\s*(?:"[^"]*\bia-(?:bouten|underline|overline)\b[^"]*"|'[^']*\bia-(?:bouten|underline|overline)\b[^']*')/i;
const literalTags = new Set(["a", "code", "pre", "script", "style", "textarea"]);

interface HtmlRange extends SourceRange {
  annotation: boolean;
}

/** Find complete fragments so conversion can splice the original source. */
export function* conversionHtmlRanges(source: string): Iterable<HtmlRange> {
  const tags = /<!--[\s\S]*?(?:-->|$)|<(\/?)([A-Za-z][\w:-]*)(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  let opening: { start: number; tag: string; depth: number; annotation: boolean } | undefined;
  for (const match of source.matchAll(tags)) {
    const [token, closing, name] = match;
    const tag = name?.toLowerCase();
    const selfClosing = token.endsWith("/>");
    if (opening) {
      if (tag !== opening.tag || selfClosing) continue;
      opening.depth += closing ? -1 : 1;
      if (opening.depth === 0) {
        yield { start: opening.start, end: match.index + token.length, annotation: opening.annotation };
        opening = undefined;
      }
    } else if (!isEscaped(source, match.index)) {
      const annotation = tag === "ruby" || (tag === "span" && annotationSpan.test(token));
      if (tag && !closing && !selfClosing && (annotation || literalTags.has(tag))) {
        opening = { start: match.index, tag, depth: 1, annotation };
      } else {
        yield { start: match.index, end: match.index + token.length, annotation: false };
      }
    }
  }
  if (opening) yield { start: opening.start, end: source.length, annotation: false };
}
