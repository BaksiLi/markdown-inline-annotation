import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { capture, npm, readJson, root, run } from "./lib.mjs";

const version = readJson("package.json").version;
const artifacts = resolve(root, "artifacts");
const tarball = resolve(artifacts, `markdown-it-inline-annotation-${version}.tgz`);
const logseq = resolve(artifacts, "logseq-furigana-ruby.zip");
const vsix = resolve(artifacts, `vscode-inline-annotation-${version}.vsix`);
const unpackJson = (archive, path) => JSON.parse(capture("unzip", ["-p", archive, path]));
assert.equal(unpackJson(logseq, "package.json").version, version);
assert.equal(unpackJson(logseq, "package.json").logseq.id, "_baksili_logseq-furigana-ruby");
assert.equal(unpackJson(vsix, "extension/package.json").version, version);
assert.equal(unpackJson(vsix, "extension/node_modules/markdown-it-inline-annotation/package.json").version, version);
assert.ok(capture("unzip", ["-p", vsix, "extension/node_modules/markdown-it-inline-annotation/dist/core.js"])
  .includes("findInlineAnnotationModel"));
assert.equal(JSON.parse(readFileSync(resolve(artifacts, "manifest.json"), "utf8")).id, "inline-annotation");
assert.equal(JSON.parse(readFileSync(resolve(artifacts, "manifest.json"), "utf8")).version, version);
assert.ok(readFileSync(resolve(artifacts, "main.js"), "utf8").length > 1000);

const consumer = mkdtempSync(resolve(tmpdir(), "inline-annotation-consumer-"));
try {
  writeFileSync(resolve(consumer, "package.json"), '{"private":true}\n');
  run(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball],
    { cwd: consumer });
  run(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createRequire } from "node:module";
    import { renderInlineAnnotationsToHtml } from "markdown-it-inline-annotation/core";
    const require = createRequire(import.meta.url);
    assert.throws(() => require.resolve("markdown-it"), { code: "MODULE_NOT_FOUND" });
    assert.match(renderInlineAnnotationsToHtml("[x]^^((semi-)formal artefact)"), /\\(semi-\\)formal artefact/);
    assert.ok(require("markdown-it-inline-annotation/fixtures/models.json").cases.length);
  `], { cwd: consumer });
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
const names = readdirSync(artifacts).filter((name) => name !== "SHA256SUMS").sort();
writeFileSync(resolve(artifacts, "SHA256SUMS"), names.map((name) =>
  `${createHash("sha256").update(readFileSync(resolve(artifacts, name))).digest("hex")}  ${name}\n`).join(""));
console.log(`Verified ${version}: standalone npm core, Logseq ZIP, Obsidian assets, and VSIX runtime.`);
