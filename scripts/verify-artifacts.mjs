import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { capture, npm, readJson, root, run } from "./lib.mjs";
import { hasPublishedMarkedAsset, releaseAssetNames, verifyReleaseChecksums } from "./release-assets.mjs";

const version = readJson("package.json").version;
const artifacts = resolve(root, "artifacts");
const published = process.argv.includes("--published");
const withMarked = !published || hasPublishedMarkedAsset(version);
if (published) verifyReleaseChecksums(artifacts, version, withMarked);
const tarball = resolve(artifacts, `markdown-it-inline-annotation-${version}.tgz`);
const logseq = resolve(artifacts, "logseq-furigana-ruby.zip");
const vsix = resolve(artifacts, `vscode-inline-annotation-${version}.vsix`);
const unpackJson = (archive, path) => JSON.parse(capture("unzip", ["-p", archive, path]));
const corePackage = JSON.parse(capture("tar", ["-xOf", tarball, "package/package.json"]));
assert.equal(corePackage.name, "markdown-it-inline-annotation");
assert.equal(corePackage.version, version);
const hasDomExport = Boolean(corePackage.exports?.["./dom"]);
if (!published) assert.ok(hasDomExport, "The core package must export ./dom");
const logseqPackage = unpackJson(logseq, "package.json");
assert.equal(logseqPackage.name, "logseq-furigana-ruby");
assert.equal(logseqPackage.version, version);
assert.equal(logseqPackage.logseq.id, "_baksili_logseq-furigana-ruby");
if (!published) {
  const requireLogseq = createRequire(resolve(root, "plugins/logseq/package.json"));
  const noticeName = "lsplugin.user.js.LICENSE.txt";
  const sdkDirectory = dirname(requireLogseq.resolve("@logseq/libs"));
  const sdkNotice = readFileSync(resolve(sdkDirectory, noticeName));
  const packagedNotice = execFileSync("unzip", ["-p", logseq, `dist/assets/${noticeName}`]);
  assert.deepEqual(packagedNotice, sdkNotice, "Logseq ZIP must ship the SDK's third-party notices verbatim");
}
assert.equal(unpackJson(vsix, "extension/package.json").name, "vscode-inline-annotation");
assert.equal(unpackJson(vsix, "extension/package.json").publisher, "baksili");
assert.equal(unpackJson(vsix, "extension/package.json").version, version);
assert.equal(unpackJson(vsix, "extension/node_modules/markdown-it-inline-annotation/package.json").version, version);
assert.ok(capture("unzip", ["-p", vsix, "extension/node_modules/markdown-it-inline-annotation/dist/core.js"])
  .includes("findInlineAnnotationModel"));
assert.equal(JSON.parse(readFileSync(resolve(artifacts, "manifest.json"), "utf8")).id, "inline-annotation");
assert.equal(JSON.parse(readFileSync(resolve(artifacts, "manifest.json"), "utf8")).version, version);
const obsidianBundle = readFileSync(resolve(artifacts, "main.js"), "utf8");
assert.ok(obsidianBundle.length > 1000);
if (!published) assert.ok(!obsidianBundle.includes("sourceMappingURL=data:"), "Obsidian release must use the production build");

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
    if (${hasDomExport}) {
      const dom = await import("markdown-it-inline-annotation/dom");
      assert.equal(typeof dom.renderInlineAnnotationModelToFragment, "function");
      assert.equal(typeof require("markdown-it-inline-annotation/dom").renderInlineAnnotationModelToFragment, "function");
    }
  `], { cwd: consumer });
  if (withMarked) {
    const markedArchive = resolve(artifacts, `marked-inline-annotation-${version}.tgz`);
    const manifest = JSON.parse(capture("tar", ["-xOf", markedArchive, "package/package.json"]));
    assert.equal(manifest.name, "marked-inline-annotation");
    assert.equal(manifest.version, version);
    assert.equal(manifest.dependencies[corePackage.name], `^${version}`);
    run(npm, ["install", "--offline", "--install-links", "--ignore-scripts", "--no-package-lock",
      "--no-audit", "--no-fund", tarball, markedArchive, resolve(root, "node_modules/marked")], { cwd: consumer });
    run(process.execPath, ["--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import { Marked } from "marked";
      import inlineAnnotation from "marked-inline-annotation";
      const html = new Marked(inlineAnnotation()).parseInline("[gloss]^^((semi-)formal artefact)");
      assert.ok(html.includes("<rt>(semi-)formal artefact</rt>"));
    `], { cwd: consumer });
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
const names = readdirSync(artifacts).filter((name) => name !== "SHA256SUMS").sort();
assert.deepEqual(names, releaseAssetNames(version, withMarked).filter((name) => name !== "SHA256SUMS"));
if (!published) {
  writeFileSync(resolve(artifacts, "SHA256SUMS"), names.map((name) =>
    `${createHash("sha256").update(readFileSync(resolve(artifacts, name))).digest("hex")}  ${name}\n`).join(""));
}
verifyReleaseChecksums(artifacts, version, withMarked);
console.log(`Verified ${version}: standalone npm core, Logseq ZIP, Obsidian assets, and VSIX runtime.`);
