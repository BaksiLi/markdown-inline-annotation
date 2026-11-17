import assert from "node:assert/strict";
import { createRequire } from "node:module";
import MarkdownIt from "markdown-it";
import inlineAnnotationPlugin from "markdown-it-inline-annotation";

const require = createRequire(import.meta.url);
const extension = require("../dist/extension.js");
const fixtureCorpus = require("markdown-it-inline-annotation/fixtures/html-render.json");
const segmentBoundaryCorpus = require("./segment-boundaries.json");

function renderInline(input) {
  const md = extension.activate().extendMarkdownIt(new MarkdownIt());
  return md.render(input).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
}

function canRunWithAdapterDefaults(fixture) {
  if (fixture.assertionType === "host-skip") return false;
  if (!fixture.options) return true;
  return fixture.options.spaceAlignment === "always";
}

assert.equal(typeof extension.activate().extendMarkdownIt, "function");
assert.deepEqual(Object.keys(fixtureCorpus.fixtureTypes).sort(), ["host-skip", "rendering-policy", "semantic"]);

const directHtml = new MarkdownIt().use(inlineAnnotationPlugin).render("[漢字]^^(かんじ)");
const extensionHtml = extension.activate().extendMarkdownIt(new MarkdownIt()).render("[漢字]^^(かんじ)");
assert.equal(extensionHtml, directHtml);

let sharedFixturesRun = 0;
let sharedFixturesSkipped = 0;
for (const fixture of fixtureCorpus.cases) {
  if (!canRunWithAdapterDefaults(fixture)) {
    sharedFixturesSkipped++;
    continue;
  }
  sharedFixturesRun++;
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

for (const fixture of segmentBoundaryCorpus.cases) {
  const source = fixture.runs.map((run) => run.text).join("");
  const html = renderInline(source);
  assert.ok(
    html.includes("ia-ruby"),
    `${fixture.id} should render when VS Code provides one contiguous Markdown source segment`
  );
}

console.log(
  `VS Code preview adapter: ${sharedFixturesRun} render fixtures passed, ` +
    `${sharedFixturesSkipped} skipped, ${segmentBoundaryCorpus.cases.length} contiguous-source boundary fixtures passed`
);
