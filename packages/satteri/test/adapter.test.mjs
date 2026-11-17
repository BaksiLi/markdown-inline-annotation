import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { markdownToHtml, mdxToJs } from "satteri";
import satteriInlineAnnotation from "../dist/index.js";

const require = createRequire(import.meta.url);
const fixtureCorpus = require("markdown-it-inline-annotation/fixtures/html-render.json");

function render(source, options = {}) {
  const preset = satteriInlineAnnotation(options);
  return markdownToHtml(source, preset).html;
}

function countOccurrences(text, pattern) {
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(pattern, cursor)) >= 0) {
    count++;
    cursor += pattern.length;
  }
  return count;
}

test("runs the shared host-neutral rendering corpus", () => {
  let fixturesRun = 0;
  let fixturesSkipped = 0;

  for (const fixture of fixtureCorpus.cases) {
    if (fixture.assertionType === "host-skip") {
      fixturesSkipped++;
      continue;
    }

    const html = render(fixture.input, fixture.options ?? {});
    for (const part of fixture.contains ?? []) {
      assert.ok(html.includes(part), `${fixture.id} missing ${part} in ${html}`);
    }
    for (const part of fixture.notContains ?? []) {
      assert.ok(!html.includes(part), `${fixture.id} unexpectedly includes ${part} in ${html}`);
    }
    for (const expected of fixture.counts ?? []) {
      assert.equal(
        countOccurrences(html, expected.pattern),
        expected.count,
        `${fixture.id} expected ${expected.pattern} count ${expected.count} in ${html}`
      );
    }
    fixturesRun++;
  }

  assert.ok(fixturesRun > 0);
  assert.equal(fixturesRun + fixturesSkipped, fixtureCorpus.cases.length);
});

test("recognizes chained slots before Satteri can treat ^_ as emphasis", () => {
  const html = render("[base]^^(over)^_(under) and [重要]^^(..)^_(.~)");
  assert.ok(html.includes("ia-ruby-double"));
  assert.ok(html.includes("ia-bouten-over ia-underline ia-underline-wavy"));
  assert.ok(!html.includes("<em>"));
});

test("keeps outer Markdown formatting around a complete expression", () => {
  const html = render("before **[漢字]^^(かんじ)** after");
  assert.ok(html.includes('<strong><ruby class="ia-ruby ia-ruby-over"'));
  assert.ok(html.includes("</ruby></strong>"));
});

test("treats Markdown-looking annotation fields as plain text", () => {
  const html = render("[漢字]^^(**讀音**)");
  assert.ok(html.includes("<rt>**讀音**</rt>"));
  assert.ok(!html.includes("<strong>讀音</strong>"));
});

test("preserves annotations owned by links, code, and raw HTML", () => {
  const source = "`[a]^^(b)` [link [c]^^(d)](/url) <span>[e]^^(f)</span> [g]^^(h)";
  const html = render(source);
  assert.ok(html.includes("<code>[a]^^(b)</code>"));
  assert.ok(html.includes('<a href="/url">link [c]^^(d)</a>'));
  assert.ok(html.includes("<span>[e]^^(f)</span>"));
  assert.equal(countOccurrences(html, "<ruby"), 1);
  assert.ok(html.includes("<rt>h</rt>"));
});

test("works in paragraphs, headings, list items, and blockquotes", () => {
  const source = "# [H]^^(head)\n\n- [L]^^(list)\n\n> [Q]^^(quote)";
  const html = render(source);
  assert.ok(html.includes("<h1><ruby"));
  assert.ok(html.includes("<li><ruby"));
  assert.ok(html.includes("<blockquote>"));
  assert.equal(countOccurrences(html, "<ruby"), 3);
});

test("avoids collisions with marker-looking source text", () => {
  const markerLikeText = "\uE000INLINEANNOTATION0\uE001";
  const html = render(`${markerLikeText} [x]^^(ann)`);
  assert.ok(html.includes(markerLikeText));
  assert.ok(html.includes("<rt>ann</rt>"));
});

test("normalizes Satteri positions before slicing JavaScript source", () => {
  const source = "😀 first paragraph\n\n🧠 prefix [漢字]^^(かんじ) suffix";
  const html = render(source);
  assert.ok(html.includes("😀 first paragraph"));
  assert.ok(html.includes("🧠 prefix <ruby"));
  assert.ok(html.includes("<rt>かんじ</rt>"));
  assert.ok(html.includes("</ruby> suffix"));
});

test("leaves MDX unchanged until literal inserted-HTML semantics are available", () => {
  const source = "Before [x]^^({danger}) after";
  const preset = satteriInlineAnnotation();
  const result = mdxToJs(source, { ...preset, jsx: true });
  assert.ok(result.code.includes('"Before [x]^^("'));
  assert.ok(!result.code.includes("<ruby"));
});
