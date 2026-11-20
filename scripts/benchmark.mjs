import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import MarkdownIt from "markdown-it";
import { markdownToHtml } from "satteri";
import { root } from "./lib.mjs";

// Run after npm run build. Optional arguments are paths to built baselines.
// INLINE_ANNOTATION_BENCH_CASE selects cases whose names contain that value.
const require = createRequire(import.meta.url);

async function load(directory, name) {
  const core = require(resolve(directory, "packages/markdown-it/dist/index.js"));
  const md = new MarkdownIt().use(core.inlineAnnotationPlugin);
  const { default: satteri } = await import(pathToFileURL(resolve(directory, "packages/satteri/dist/index.js")));
  return {
    name,
    core: core.renderInlineAnnotationsToHtml,
    markdown: (source) => md.renderInline(source),
    satteri: (source) => markdownToHtml(source, satteri()).html,
  };
}

const builds = await Promise.all([
  ...process.argv.slice(2).map((directory) => load(directory, basename(directory))),
  load(root, "working tree"),
]);
const selected = process.env.INLINE_ANNOTATION_BENCH_CASE ?? "";
const scenarios = [
  ["Core plain prose", "core", "Inline Annotation keeps multilingual prose readable. ".repeat(160)],
  ["Core long word", "core", "x".repeat(8192) + " [漢字]^^(かんじ)"],
  ["Core unclosed brackets", "core", "[".repeat(4096) + "[漢字]^^(かんじ)"],
  ["Core nested bases", "core", "[".repeat(512) + "字" + "]^^(r)".repeat(512)],
  ["markdown-it mixed content", "markdown", "[link](/url) **bold** [漢字]^^(かんじ) and [a]^_(.-). ".repeat(120)],
  ["markdown-it punctuation ×8192", "markdown", "-".repeat(8192) + " [字]^^(r)"],
  ["markdown-it punctuation ×32768", "markdown", "-".repeat(32768) + " [字]^^(r)"],
  ["Satteri long ASCII paragraph", "satteri", "**bold** [word]^^(reading) ".repeat(2048)],
  ["Satteri long multilingual paragraph", "satteri", "**bold** [𠮷語]^^(reading) ".repeat(2048)],
].filter(([name]) => name.includes(selected));
assert.ok(scenarios.length, "No benchmark matched the requested case");

function time(render, source, count) {
  const start = performance.now();
  let lastCharacters = 0;
  for (let i = 0; i < count; i++) {
    const result = render(source);
    lastCharacters += result.charCodeAt(result.length - 1);
  }
  const elapsed = performance.now() - start;
  assert.ok(Number.isFinite(lastCharacters));
  return elapsed / count;
}

const report = [];
for (const [scenario, renderer, source] of scenarios) {
  const renders = builds.map((build) => build[renderer]);
  const expected = renders[0](source);
  for (const render of renders) assert.equal(render(source), expected, scenario);
  const counts = renders.map((render) => Math.max(1, Math.min(1000, Math.ceil(15 / time(render, source, 1)))));
  const samples = renders.map(() => []);
  for (let sample = 0; sample < 9; sample++) {
    for (let i = 0; i < renders.length; i++) {
      const index = sample % 2 ? renders.length - 1 - i : i;
      const ms = time(renders[index], source, counts[index]);
      if (sample >= 2) samples[index].push(ms);
    }
  }
  report.push({
    scenario,
    codeUnits: source.length,
    ...Object.fromEntries(builds.map(({ name }, index) => [name, Number(samples[index].sort((a, b) => a - b)[3].toFixed(4))])),
  });
}

console.log(`Node ${process.version} ${process.platform}/${process.arch} · median ms per render, 7 batches`);
console.table(report);
