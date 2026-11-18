import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { findInlineAnnotationModel, renderInlineAnnotationModelToHtml } from "../../packages/markdown-it/dist/core.mjs";

const stage = mkdtempSync(join(tmpdir(), "inline-annotation-silverbullet-test-"));
after(() => rmSync(stage, { recursive: true, force: true }));
copyFileSync(new URL("./space/Library/BaksiLi/inline-annotation.js", import.meta.url), join(stage, "inline-annotation.js"));
copyFileSync(new URL("../../packages/markdown-it/dist/core.mjs", import.meta.url), join(stage, "inline-annotation-core.js"));
const { startMarker, endMarker, render } = await import(pathToFileURL(join(stage, "inline-annotation.js")));

function matchRegion(source) {
  // SilverBullet matches against the suffix at the opening bracket.
  const start = new RegExp(startMarker, "y").exec(source);
  if (!start) return null;
  const end = new RegExp(endMarker, "g");
  end.lastIndex = start[0].length;
  const close = end.exec(source);
  assert.ok(close, `Start marker accepted source without a closing marker: ${source}`);
  return { end: close.index + close[0].length, body: source.slice(start[0].length, close.index) };
}

const { cases } = JSON.parse(readFileSync(new URL("../../fixtures/html-render.json", import.meta.url), "utf8"));
const fixtureIds = [
  "ruby-basic-over", "ruby-basic-under", "ruby-mixed-chain", "ruby-reverse-chain",
  "ruby-pipe-saturated-passes-through", "ruby-pipe-extra-level-passes-through",
  "parentheses-nested", "parentheses-chain", "parentheses-pipe-inside-pair",
];
const sources = fixtureIds.map(id => cases.find(fixture => fixture.id === id).input);
sources.push(
  "[term]^^(constructor)",
  "[term]^_(toString)",
  "[term]^^(outer (mid (inner (detail))))^_(under (detail))",
  "[term]^^(x)^_()",
  "[term]^_(x)^^((unfinished)",
  "[term]^^(x)^^(same side)",
  "[term]^^(x)^_(y|z)",
  String.raw`[ter\]m]^^(x\|y)^_(z\)w)`,
  String.raw`[term]^^(literal \\)^_(y)`,
);

for (const source of sources) {
  test(`uses the core source boundary and rendering for ${source}`, () => {
    const model = findInlineAnnotationModel(source);
    assert.equal(model?.start, 0);
    const region = matchRegion(source);
    assert.equal(region?.end, model.end);
    assert.equal(render(region.body), renderInlineAnnotationModelToHtml(model, { spaceAlignment: "auto" }));
  });
}

test("leaves incomplete primary slots and ordinary Markdown to SilverBullet", () => {
  for (const source of ["[plain](url)", "[term]^^()", "[term]^^((unfinished)", "[term]^^(line\nbreak)"]) {
    assert.equal(matchRegion(source), null, source);
  }
});
