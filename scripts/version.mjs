import assert from "node:assert/strict";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { npm, readJson, root, run, workspaces, writeJson } from "./lib.mjs";

const current = readJson("package.json").version;
const requested = process.argv[2];
assert.ok(requested, "Usage: npm run release:prepare -- patch|minor|major|x.y.z");
const parts = current.split(".").map(Number);
const index = { major: 0, minor: 1, patch: 2 }[requested];
if (index !== undefined) {
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
}
const version = index === undefined ? requested : parts.join(".");
assert.match(version, /^\d+\.\d+\.\d+$/, "Use a stable semver release");
assert.ok(
  version.localeCompare(current, undefined, { numeric: true }) >= 0,
  "Version cannot decrease",
);
const pkg = readJson("package.json");
pkg.version = version;
writeJson("package.json", pkg);
for (const workspace of workspaces) {
  const item = readJson(`${workspace}/package.json`);
  item.version = version;
  if (item.dependencies?.["markdown-it-inline-annotation"]) {
    item.dependencies["markdown-it-inline-annotation"] = `^${version}`;
  }
  writeJson(`${workspace}/package.json`, item);
}
const manifest = readJson("plugins/obsidian/manifest.json");
manifest.version = version;
const versions = readJson("plugins/obsidian/versions.json");
versions[version] = manifest.minAppVersion;
writeJson("plugins/obsidian/manifest.json", manifest);
writeJson("plugins/obsidian/versions.json", versions);
for (const name of ["manifest.json", "versions.json"]) {
  copyFileSync(resolve(root, "plugins/obsidian", name), resolve(root, name));
}
run(npm, ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
console.log(`Prepared ${version}. Review changes, commit, then push the bare ${version} tag.`);
