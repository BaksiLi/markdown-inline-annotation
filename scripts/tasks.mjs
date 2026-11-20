import assert from "node:assert/strict";
import { copyFileSync, readFileSync } from "node:fs";
import { npm, readJson, root, run, workspaces } from "./lib.mjs";

const [task, ...args] = process.argv.slice(2);
assert.ok(["build", "test", "check"].includes(task), "Expected build, test, or check");
const pack = task === "check" && args.length === 1 && args[0] === "--pack";
assert.ok(args.length === 0 || pack, "Use --pack with check to verify release artifacts");

const version = readJson("package.json").version;
for (const workspace of workspaces) {
  const pkg = readJson(`${workspace}/package.json`);
  assert.equal(pkg.version, version, `${workspace} must follow the release version`);
  if (pkg.dependencies?.["markdown-it-inline-annotation"]) {
    assert.equal(pkg.dependencies["markdown-it-inline-annotation"], `^${version}`);
  }
}
for (const name of ["manifest.json", "versions.json"]) {
  assert.equal(
    readFileSync(`${root}/${name}`, "utf8"),
    readFileSync(`${root}/plugins/obsidian/${name}`, "utf8"),
    `${name} is generated; run npm run release:prepare -- ${version}`,
  );
}

if (task === "check") run(process.execPath, ["scripts/sync-showcase.mjs", "--check"]);

for (const workspace of workspaces) {
  run(npm, ["run", task, "--workspace", workspace]);
  if (workspace === "packages/markdown-it" && task === "check") {
    run(process.execPath, ["packages/markdown-it/scripts/build-examples.mjs", "--check"]);
  }
  if (workspace === "plugins/obsidian" && task !== "test") {
    for (const name of ["main.js", "styles.css"]) {
      copyFileSync(`${root}/plugins/obsidian/${name}`, `${root}/${name}`);
    }
  }
}
if (task !== "build") run(process.execPath, ["--test", "scripts/*.test.mjs"]);
if (task === "check") run("git", ["diff", "--check"]);
if (pack) run(process.execPath, ["scripts/package.mjs", "--built"]);
