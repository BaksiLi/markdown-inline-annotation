import type {
  AnnotationOp,
  AnnotationPosition,
  InlineAnnotationForm,
  InlineAnnotationModel,
  InlineAnnotationRange,
  InlineAnnotationSlot,
} from "./model.js";

function isEscaped(input: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && input[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

function opAt(input: string, index: number, max: number): AnnotationOp | null {
  if (index + 2 >= max || input[index] !== "^" || input[index + 2] !== "(") return null;
  if (isEscaped(input, index)) return null;
  if (input[index + 1] === "^") return "^^";
  if (input[index + 1] === "_") return "^_";
  return null;
}

export function opposite(op: AnnotationOp): AnnotationOp {
  return op === "^^" ? "^_" : "^^";
}

export function positionForOp(op: AnnotationOp): AnnotationPosition {
  return op === "^^" ? "over" : "under";
}

function range(input: string, start: number, end: number): InlineAnnotationRange {
  return { start, end, raw: input.slice(start, end) };
}

function nextPipe(input: string, start: number): number {
  let pipe = input.indexOf("|", start);
  while (pipe >= 0) {
    if (!isEscaped(input, pipe)) return pipe;
    pipe = input.indexOf("|", pipe + 1);
  }
  return input.length;
}

// The base run stops at the first caret or syntax boundary. If that run does
// not introduce a valid annotation, none of its suffixes can introduce one.
const abbreviatedBase = /[^\s\[\]()<>\x60*&!^]+/y;
// Match markdown-it's text-rule terminators so an earlier host rule still gets
// its turn when no annotation starts before the terminator.
const markdownBlocker = /[\r\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

export class AnnotationScanner {
  private readonly brackets = new Map<number, number>();
  private readonly parentheses = new Map<number, number>();
  private blockedBase?: { start: number; end: number; lastBlocker: number };
  private readonly max: number;

  constructor(
    private readonly input: string,
    max: number,
    private readonly abbreviated: boolean,
    private readonly stopBeforeMarkdown = false,
  ) {
    this.max = Math.min(input.length, max);
  }

  private closeDelimiter(start: number, open: string, close: string, cache: Map<number, number>): number {
    const cached = cache.get(start);
    if (cached !== undefined) return cached;

    // Remember any nested pairs visited along the way, including unclosed
    // ones. An invalid outer candidate must still allow inner ones to match.
    let nested: number[] | undefined;
    for (let i = start + 1; i < this.max; i++) {
      const ch = this.input[i];
      if (ch === "\n" || ch === "\r") break;
      if (ch === open && !isEscaped(this.input, i)) {
        (nested ??= []).push(i);
      } else if (ch === close && !isEscaped(this.input, i)) {
        if (!nested?.length) {
          cache.set(start, i);
          return i;
        }
        cache.set(nested.pop()!, i);
      }
    }
    if (nested) {
      for (const index of nested) cache.set(index, -1);
    }
    cache.set(start, -1);
    return -1;
  }

  private parseSlots(
    form: InlineAnnotationForm,
    start: number,
    base: InlineAnnotationRange,
    operatorStart: number,
    op: AnnotationOp,
    max: number,
  ): InlineAnnotationModel | null {
    const { input } = this;
    const open = operatorStart + 2;
    const annStart = open + 1;
    const annEnd = this.closeDelimiter(open, "(", ")", this.parentheses);
    if (annEnd <= annStart || annEnd >= max) return null;

    const ann = input.slice(annStart, annEnd);
    const firstPipe = annStart + nextPipe(ann, 0);
    const slots: InlineAnnotationSlot[] = [
      { ...range(input, annStart, firstPipe), position: positionForOp(op), source: "primary" },
    ];
    const overflow: InlineAnnotationRange[] = [];
    let end = annEnd + 1;

    if (firstPipe < annEnd) {
      const secondPipe = annStart + nextPipe(ann, firstPipe - annStart + 1);
      slots.push({ ...range(input, firstPipe + 1, secondPipe), position: positionForOp(opposite(op)), source: "pipe" });
      if (secondPipe < annEnd) overflow.push(range(input, secondPipe, annEnd));
    } else {
      // Once a pipe fills the second slot, a chained operator stays in the source.
      const nextOp = opAt(input, end, max);
      if (nextOp && nextOp !== op) {
        const secondStart = end + 3;
        const secondEnd = this.closeDelimiter(end + 2, "(", ")", this.parentheses);
        if (secondEnd > secondStart && secondEnd < max) {
          slots.push({ ...range(input, secondStart, secondEnd), position: positionForOp(nextOp), source: "chain" });
          end = secondEnd + 1;
        }
      }
    }

    return { form, start, end, source: input.slice(start, end), base, primaryOp: op, slots, overflow };
  }

  find(start: number, limit = this.max): InlineAnnotationModel | null {
    const { input, stopBeforeMarkdown } = this;
    const max = Math.min(this.max, limit);
    for (let i = Math.max(0, start); i < max; i++) {
      const ch = input[i];
      // At the start of a base, let the host interpret its emphasis markers.
      if (stopBeforeMarkdown && (ch === "_" || input.startsWith("~~", i))) return null;
      if (ch === "[" && !isEscaped(input, i)) {
        const close = this.closeDelimiter(i, "[", "]", this.brackets);
        const op = close >= 0 && opAt(input, close + 1, max);
        if (op) {
          const model = this.parseSlots("bracketed", i, range(input, i + 1, close), close + 1, op, max);
          if (model) return model;
        }
      } else if (this.abbreviated) {
        const blocked = this.blockedBase;
        if (blocked && i >= blocked.start && i < blocked.end) {
          if (i <= blocked.lastBlocker) return null;
          i = blocked.end - 1;
          continue;
        }
        abbreviatedBase.lastIndex = i;
        const base = abbreviatedBase.exec(input)?.[0];
        if (base) {
          const end = i + base.length;
          const op = opAt(input, end, max);
          if (op) {
            const model = this.parseSlots("abbreviated", i, { start: i, end, raw: base }, end, op, max);
            if (model) return model;
          }
          if (stopBeforeMarkdown && markdownBlocker.test(base)) {
            // The host can retry at each punctuation character in the same
            // run. An unsuccessful suffix shares the same operator boundary.
            if (max === this.max) {
              let lastBlocker = end - 1;
              while (!markdownBlocker.test(input[lastBlocker])) lastBlocker--;
              this.blockedBase = { start: i, end, lastBlocker };
            }
            return null;
          }
          i = end - 1;
          continue;
        }
      }
      if (stopBeforeMarkdown && markdownBlocker.test(ch)) return null;
    }
    return null;
  }
}

export function hasInlineAnnotation(input: string): boolean {
  return input.includes("^^(") || input.includes("^_(");
}
