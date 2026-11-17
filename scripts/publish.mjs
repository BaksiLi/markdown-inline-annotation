import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { capture, readJson, root, run } from "./lib.mjs";

const version = readJson("package.json").version;
const repo = "BaksiLi/markdown-inline-annotation";
assert.equal(process.env.GITHUB_REF_TYPE, "tag", "Publish through the tagged release workflow");
assert.equal(process.env.GITHUB_REF_NAME, version, "Tag must match the shared package version");
const directory = resolve(root, "artifacts");
const names = readdirSync(directory).sort();
assert.ok(names.includes("SHA256SUMS"), "Run release:pack before publishing");
function findRelease() {
  // The tag endpoint does not reliably find drafts; the authenticated list includes them.
  const pages = JSON.parse(capture("gh",
    ["api", "--paginate", "--slurp", `repos/${repo}/releases?per_page=100`]));
  const matches = pages.flat().filter((item) => item.tag_name === version);
  assert.ok(matches.length <= 1, `Multiple releases exist for ${version}`);
  return matches[0];
}
let release = findRelease();
if (!release) {
  run("gh", ["release", "create", version, "--repo", repo, "--verify-tag", "--draft",
    "--title", `Inline Annotation ${version}`, "--notes-file", "RELEASE_NOTES.md"]);
  release = findRelease();
}
assert.ok(release, `Cannot locate release ${version} after creation`);
assert.deepEqual(release.assets.map((asset) => asset.name).filter((name) => !names.includes(name)),
  [], "Release contains unexpected assets; refusing to publish an ambiguous bundle");
for (const name of names) {
  const path = resolve(directory, name);
  const existing = release.assets.find((asset) => asset.name === name);
  if (existing) {
    const expected = createHash("sha256").update(readFileSync(path)).digest("hex");
    const remote = spawnSync("gh", ["api", `repos/${repo}/releases/assets/${existing.id}`,
      "-H", "Accept: application/octet-stream"], { maxBuffer: 50 * 1024 * 1024 });
    assert.equal(remote.status, 0, `Cannot verify previously uploaded ${name}`);
    assert.equal(createHash("sha256").update(remote.stdout).digest("hex"), expected,
      `Published ${name} differs; bump the version instead of replacing it`);
  } else {
    run("gh", ["release", "upload", version, path, "--repo", repo]);
  }
}
run("gh", ["release", "edit", version, "--repo", repo, "--draft=false", "--latest"]);
