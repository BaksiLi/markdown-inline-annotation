import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.contributes?.["markdown.markdownItPlugins"], true);
assert.ok(!pkg.contributes?.["markdown.previewScripts"], "preview scripts are intentionally out of scope");
assert.ok(!pkg.contributes?.["markdown.previewStyles"], "inline styles from the core package keep v1 self-contained");
assert.equal(pkg.main, "./dist/extension.js");

console.log("VS Code package manifest checks passed");
