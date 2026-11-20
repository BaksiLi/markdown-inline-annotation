import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fileURLToPath } from "node:url";
import { npm, run } from "../../../scripts/lib.mjs";

const node = process.execPath;
const cwd = fileURLToPath(new URL("../", import.meta.url));
run(node, ["scripts/build-examples.mjs"], { cwd });

const releaseRoot = mkdtempSync(join(tmpdir(), "inline-annotation-release-"));
try {
  run(npm, ["pack", "--pack-destination", releaseRoot, "--ignore-scripts"], { cwd });
  const tarball = readdirSync(releaseRoot).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack did not produce a tarball");

  const consumer = join(releaseRoot, "core-consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true }, null, 2));
  run(npm, [
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    "--no-audit",
    "--no-fund",
    "--offline",
    join(releaseRoot, tarball),
  ], { cwd: consumer });
  run(node, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createRequire } from "node:module";
    import { renderInlineAnnotationsToHtml } from "markdown-it-inline-annotation/core";
    import { renderInlineAnnotationModelToFragment } from "markdown-it-inline-annotation/dom";
    const require = createRequire(import.meta.url);
    const core = require("markdown-it-inline-annotation/core");
    const dom = require("markdown-it-inline-annotation/dom");
    assert.equal(typeof core.findInlineAnnotationModel, "function");
    assert.equal(typeof dom.renderInlineAnnotationModelToFragment, "function");
    assert.equal(typeof renderInlineAnnotationModelToFragment, "function");
    assert.match(renderInlineAnnotationsToHtml("[x]^^(reading)"), /<rt>reading<\\/rt>/);
    assert.throws(() => require.resolve("markdown-it"), { code: "MODULE_NOT_FOUND" });
    for (const fixture of ["html-render", "models", "segment-boundaries"]) {
      const corpus = require(\`markdown-it-inline-annotation/fixtures/\${fixture}.json\`);
      assert.equal(corpus.version, 1);
      assert.ok(corpus.cases.length > 0);
    }
    console.log("CommonJS and ESM package exports verified without markdown-it");
  `], { cwd: consumer });
} finally {
  rmSync(releaseRoot, { recursive: true, force: true });
}
