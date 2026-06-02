import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.contributes?.["markdown.markdownItPlugins"], true);
assert.ok(!pkg.contributes?.["markdown.previewScripts"], "preview scripts are intentionally out of scope");
assert.ok(!pkg.contributes?.["markdown.previewStyles"], "inline styles from the core package keep v1 self-contained");
assert.equal(pkg.main, "./dist/extension.js");
assert.equal(pkg.dependencies?.["markdown-it-inline-annotation"], "^0.3.2");
assert.ok(!pkg.dependencies?.["markdown-it"], "do not depend on markdown-it directly at runtime");
assert.ok(existsSync(new URL("../dist/extension.js", import.meta.url)), "dist/extension.js must exist");
assert.ok(existsSync(new URL("../README.md", import.meta.url)), "README.md must exist");
assert.ok(existsSync(new URL("../LICENSE", import.meta.url)), "LICENSE must exist");

console.log("VS Code package manifest checks passed");
