import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import MarkdownIt from "markdown-it";
import inlineAnnotationPlugin from "markdown-it-inline-annotation";
import { assertRenderFixture } from "../../../scripts/assert-render-fixture.cjs";

const require = createRequire(import.meta.url);
const extension = require("../dist/extension.js");
const fixtureCorpus = require("markdown-it-inline-annotation/fixtures/html-render.json");
const segmentBoundaryCorpus = require("markdown-it-inline-annotation/fixtures/segment-boundaries.json");

const md = extension.activate().extendMarkdownIt(new MarkdownIt());

test("activates the markdown-it plugin with its default behavior", () => {
  const source = "[漢字]^^(かんじ)";
  assert.equal(md.render(source), new MarkdownIt().use(inlineAnnotationPlugin).render(source));
});

for (const fixture of fixtureCorpus.cases) {
  const skip = fixture.hostSkip?.join(", ") ||
    (fixture.options && fixture.options.spaceAlignment !== "always" ? "VS Code uses default alignment" : undefined);
  test(fixture.id, { skip }, () => {
    const html = md.render(fixture.input).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
    assertRenderFixture(html, fixture);
  });
}

for (const fixture of segmentBoundaryCorpus.cases) {
  test(`${fixture.id} when VS Code provides contiguous Markdown`, () => {
    const source = fixture.runs.map((run) => run.text).join("");
    assert.match(md.render(source), /ia-ruby/);
  });
}
