import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { Marked } from "marked";
import inlineAnnotation from "marked-inline-annotation";

const require = createRequire(import.meta.url);
const corpus = require("markdown-it-inline-annotation/fixtures/html-render.json");
for (const fixture of corpus.cases) {
  test(fixture.id, () => {
    const html = new Marked(inlineAnnotation(fixture.options)).parse(fixture.input);
    for (const part of fixture.contains ?? []) assert.ok(html.includes(part), html);
    for (const part of fixture.notContains ?? []) assert.ok(!html.includes(part), html);
    for (const { pattern, count } of fixture.counts ?? []) {
      assert.equal(html.split(pattern).length - 1, count, html);
    }
  });
}

const md = new Marked(inlineAnnotation());
const vanilla = new Marked();
test("preserves Marked-owned source", () => {
  for (const source of [
    "`[x]^^(code)`", "```md\n[x]^^(code)\n```",
    "[a [x]^^(label)](/dest)", "![a [x]^^(alt)](/img)",
    "[[x]^^(label)][ref]\n\n[ref]: /dest",
    "<code>[x]^^(code)</code>", '<a href="/">[x]^^(link)</a>',
    'before <i title="[x]^^(attr)">text</i>', "<pre>\n[x]^^(code)\n</pre>",
    "www.example.com/path^^(x)", "https://example.com/a^^(x)",
    String.raw`\[x]^^(escaped) a\^^(b)`,
  ]) assert.equal(md.parse(source), vanilla.parse(source), source);
});

test("keeps outer formatting and surrounding text", () => {
  for (const [source, tag] of [
    ["**[字]^^(gloss)**", "strong"], ["_字^^(gloss)_", "em"],
    ["~~[字]^_(gloss)~~", "del"], ["*[x]^^(*literal)*", "em"],
    ["**[x]^^(a**b)**", "strong"], ["~~[x]^^(~~)~~", "del"],
  ]) {
    const html = md.parseInline(source);
    assert.ok(html.startsWith(`<${tag}><ruby`) && html.endsWith(`</ruby></${tag}>`), html);
  }
  assert.match(md.parseInline("😀^^(face)"), />😀<rp>/);
  assert.match(md.parseInline("one &amp; 東京^^(とうきょう) two"), /^one &amp; <ruby.*> two$/);
});

test("allows bracket-only hosts and per-instance renderer options", () => {
  const md = new Marked(inlineAnnotation({ enableAbbreviated: false, classPrefix: "gloss" }));
  assert.match(md.parseInline("a^^(b) [c]^^(d)"), /^a\^\^\(b\) <ruby class="gloss-ruby /);
});
