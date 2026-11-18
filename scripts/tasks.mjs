import assert from "node:assert/strict";
import { copyFileSync, readFileSync } from "node:fs";
import { npm, readJson, root, run, workspaces } from "./lib.mjs";

const task = process.argv[2];
assert.ok(["build", "test", "check"].includes(task), "Expected build, test, or check");
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

for (const workspace of workspaces) {
  const scripts = readJson(`${workspace}/package.json`).scripts;
  const script = task === "check"
    ? (scripts["check:release"] ? "check:release" : scripts.check ? "check" : "test")
    : task;
  run(npm, ["run", script, "--workspace", workspace]);
  if (task === "check" && workspace === "plugins/logseq") {
    run(npm, ["run", "build", "--workspace", workspace]);
  }
  if (workspace === "plugins/obsidian" && task !== "test") {
    for (const name of ["main.js", "styles.css"]) {
      copyFileSync(`${root}/plugins/obsidian/${name}`, `${root}/${name}`);
    }
  }
}
if (task !== "build") {
  run(process.execPath, [
    "--test",
    "scripts/publish.test.mjs",
    "scripts/release-assets.test.mjs",
    "scripts/download-stats.test.mjs",
    "plugins/silverbullet/adapter.test.mjs",
  ]);
}
if (task === "check") run("git", ["diff", "--check"]);
