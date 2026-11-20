import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { assertRenderFixture } from "../../../scripts/assert-render-fixture.cjs";
import { markdownToHtml, mdxToJs } from "satteri";
import { renderInlineAnnotationsToHtml } from "markdown-it-inline-annotation/core";
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

for (const fixture of fixtureCorpus.cases) {
  test(fixture.id, { skip: fixture.hostSkip?.join(", ") }, () => {
    assertRenderFixture(render(fixture.input, fixture.options), fixture);
  });
}

test("renders the shared showcase with the core semantics", () => {
  const examples = require("../../../docs/examples/showcase.json");
  for (const source of examples) {
    assert.equal(render(source).trim(), `<p>${renderInlineAnnotationsToHtml(source)}</p>`, source);
  }
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

test("preserves link and code boundaries after a long mixed-encoding prefix", () => {
  const prefix = "ASCII ".repeat(512) + "𠮷 e\u0301 🙂 ";
  const source = prefix + "[link [x]^^(label)](/dest) `𠮷^^(code)` [𠮷]^^(reading)";
  const html = render(source);
  assert.ok(html.startsWith("<p>" + prefix));
  assert.ok(html.includes('<a href="/dest">link [x]^^(label)</a>'));
  assert.ok(html.includes("<code>𠮷^^(code)</code>"));
  assert.equal(countOccurrences(html, "<ruby"), 1);
  assert.ok(html.includes("<rt>reading</rt>"));
});

test("maps Satteri child positions independently of paragraph positions", () => {
  const read = "𠮷 e\u0301 🙂 [link [x]^^(label)](/dest) `𠮷^^(code)` [𠮷]^^(reading)";
  for (const separator of ["\n\n", "\r\n\r\n"]) {
    const source = "Title 😀 [x]^^(title)" + separator + read;
    const html = render(source);
    assert.ok(html.includes("<rt>title</rt>"));
    assert.ok(html.includes('<a href="/dest">link [x]^^(label)</a>'));
    assert.ok(html.includes("<code>𠮷^^(code)</code>"));
    assert.equal(countOccurrences(html, "<ruby"), 2);
    assert.ok(html.includes("<rt>reading</rt>"));
  }
});

test("leaves MDX unchanged until literal inserted-HTML semantics are available", () => {
  const source = "Before [x]^^({danger}) after";
  const preset = satteriInlineAnnotation();
  const result = mdxToJs(source, { ...preset, jsx: true });
  assert.ok(result.code.includes('"Before [x]^^("'));
  assert.ok(!result.code.includes("<ruby"));
});
