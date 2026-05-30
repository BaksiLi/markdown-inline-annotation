import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import MarkdownIt from "../../markdown-it-inline-annotation/node_modules/markdown-it/index.mjs";
import inlineAnnotationPlugin from "../../markdown-it-inline-annotation/dist/index.mjs";

const require = createRequire(import.meta.url);
const extension = require("../dist/extension.js");
const fixtureCorpus = JSON.parse(
  readFileSync(new URL("../../markdown-it-inline-annotation/fixtures/html-render.json", import.meta.url), "utf8")
);

function renderInline(input) {
  const md = extension.activate().extendMarkdownIt(new MarkdownIt());
  return md.render(input).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
}

assert.equal(typeof extension.activate().extendMarkdownIt, "function");

const directHtml = new MarkdownIt().use(inlineAnnotationPlugin).render("[漢字]^^(かんじ)");
const extensionHtml = extension.activate().extendMarkdownIt(new MarkdownIt()).render("[漢字]^^(かんじ)");
assert.equal(extensionHtml, directHtml);

for (const fixture of fixtureCorpus.cases) {
  const html = renderInline(fixture.input);
  for (const part of fixture.contains ?? []) {
    assert.ok(html.includes(part), `${fixture.id} missing ${part} in ${html}`);
  }
  for (const part of fixture.notContains ?? []) {
    assert.ok(!html.includes(part), `${fixture.id} unexpectedly includes ${part} in ${html}`);
  }
  for (const count of fixture.counts ?? []) {
    assert.equal(
      html.split(count.pattern).length - 1,
      count.count,
      `${fixture.id} expected ${count.pattern} count ${count.count} in ${html}`
    );
  }
}

console.log(`VS Code preview adapter: ${fixtureCorpus.cases.length} shared fixtures passed`);
