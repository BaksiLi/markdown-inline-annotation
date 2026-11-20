export interface SourceRange {
  from: number;
  to: number;
}

export function mergeSourceRanges(ranges: readonly SourceRange[]): SourceRange[] {
  const sorted = ranges
    .filter((range) => range.to > range.from)
    .sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: SourceRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.from <= previous.to) {
      previous.to = Math.max(previous.to, range.to);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

function countRun(text: string, index: number, char: string): number {
  let count = 0;
  while (text[index + count] === char) count++;
  return count;
}

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let pos = index - 1; pos >= 0 && text[pos] === "\\"; pos--) backslashes++;
  return backslashes % 2 === 1;
}

function matchDelimiters(text: string, open: string, close: string): Map<number, number> {
  const starts: number[] = [];
  const pairs = new Map<number, number>();
  for (let pos = 0; pos < text.length; pos++) {
    const char = text[pos];
    if ((char !== open && char !== close) || isEscaped(text, pos)) continue;
    if (char === open) {
      starts.push(pos);
    } else if (starts.length) {
      pairs.set(starts.pop()!, pos);
    }
  }
  return pairs;
}

function findClosingDelimiter(text: string, open: number, delimiter: string): number {
  for (let pos = open + delimiter.length; pos < text.length; pos++) {
    if (isEscaped(text, pos)) continue;
    if (text.startsWith(delimiter, pos)) return pos + delimiter.length;
  }
  return -1;
}

export function collectFallbackHostMarkdownRanges(text: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  const canHaveLinks = text.includes("](") || text.includes("][");
  let brackets: Map<number, number> | undefined;
  let parens: Map<number, number> | undefined;
  let wikiClosersExhausted = false;
  let pos = 0;

  while (pos < text.length) {
    if (text[pos] === "`") {
      const tickCount = countRun(text, pos, "`");
      const delimiter = "`".repeat(tickCount);
      const end = findClosingDelimiter(text, pos, delimiter);
      if (end > pos) {
        ranges.push({ from: pos, to: end });
        pos = end;
        continue;
      }
    }

    if (text[pos] === "$" && !isEscaped(text, pos)) {
      const delimiter = text[pos + 1] === "$" ? "$$" : "$";
      const end = findClosingDelimiter(text, pos, delimiter);
      if (end > pos) {
        ranges.push({ from: pos, to: end });
        pos = end;
        continue;
      }
    }

    if (!wikiClosersExhausted && text.startsWith("[[", pos) && !isEscaped(text, pos)) {
      const end = text.indexOf("]]", pos + 2);
      if (end !== -1) {
        ranges.push({ from: pos, to: end + 2 });
        pos = end + 2;
        continue;
      }
      wikiClosersExhausted = true;
    }

    if (text[pos] === "<" && !isEscaped(text, pos)) {
      const end = text.indexOf(">", pos + 1);
      if (end !== -1) {
        const tag = text.slice(pos, end + 1);
        if (/^<\/?[A-Za-z][^>]*>$/.test(tag)) {
          ranges.push({ from: pos, to: end + 1 });
          pos = end + 1;
          continue;
        }
      }
    }

    const linkStart = text[pos] === "!" && text[pos + 1] === "[" ? pos + 1 : text[pos] === "[" ? pos : -1;
    if (canHaveLinks && linkStart !== -1 && !isEscaped(text, linkStart)) {
      brackets ??= matchDelimiters(text, "[", "]");
      const labelEnd = brackets.get(linkStart);
      if (labelEnd !== undefined) {
        if (text[labelEnd + 1] === "(") {
          parens ??= matchDelimiters(text, "(", ")");
          const linkEnd = parens.get(labelEnd + 1);
          if (linkEnd !== undefined) {
            ranges.push({ from: pos, to: linkEnd + 1 });
            pos = linkEnd + 1;
            continue;
          }
        } else if (text[labelEnd + 1] === "[") {
          const referenceEnd = brackets.get(labelEnd + 1);
          if (referenceEnd !== undefined) {
            ranges.push({ from: pos, to: referenceEnd + 1 });
            pos = referenceEnd + 1;
            continue;
          }
        }
      }
    }

    pos++;
  }

  return mergeSourceRanges(ranges);
}
