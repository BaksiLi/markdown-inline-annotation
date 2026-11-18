import { renderInlineAnnotationsToHtml } from "./inline-annotation-core.js";

const opening = "\\[";
const closing = "\\)";
const over = "\\^\\^\\(";
const under = "\\^_\\(";
const escaped = "\\\\[^\\r\\n]";
const base = "(?:" + escaped + "|[^\\[\\]\\\\<>\\x60*_~&|\\r\\n])+\\]";

function slotContent(excluded = "") {
  const unit = "(?:" + escaped + "|[^\\\\()\\r\\n" + excluded + "])";
  // The host accepts delimiter regexes. Unroll three levels of the same
  // balanced group, allowing empty inner pairs while requiring a nonempty slot.
  let group = unit;
  for (let depth = 0; depth < 3; depth++) {
    group = "(?:" + unit + "|\\(" + group + "*\\))";
  }
  return group + "+";
}

const slot = slotContent();
const withoutPipe = slotContent("|");

function regions(first, opposite) {
  const prefix = base + first;
  const chain = opposite + slot;
  return [
    // Prefer a complete opposite slot and keep the first slot visible while
    // the second is empty or still being written.
    { body: prefix + withoutPipe + closing + chain, after: "" },
    // A pipe in the first body already supplies the opposite slot.
    { body: prefix + "(?!" + withoutPipe + closing + ")" + slot, after: "" },
    { body: prefix + withoutPipe, after: "(?!" + chain + closing + ")" },
  ];
}

const forms = [...regions(over, under), ...regions(under, over)];

// The host runs both patterns against the suffix beginning at the opening
// bracket. The lookahead claims only complete forms. The anchored lookbehind
// makes the end marker skip escaped, nested and intermediate chain closers.
export const startMarker = opening + "(?=" +
  forms.map(({ body, after }) => body + closing + after).join("|") + ")";
export const endMarker = forms
  .map(({ body, after }) => "(?<=^" + opening + body + ")" + closing + after)
  .join("|");

export function render(body) {
  return renderInlineAnnotationsToHtml("[" + body + ")", { spaceAlignment: "auto" });
}
