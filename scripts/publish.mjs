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
  const tag = JSON.parse(capture("gh", ["api", `repos/${repo}/git/ref/tags/${version}`]));
  assert.equal(tag.ref, `refs/tags/${version}`, "Release tag must already exist");
  // Use the creation response directly: a new draft may not appear in lookups yet.
  release = JSON.parse(capture("gh",
    ["api", "--method", "POST", `repos/${repo}/releases`, "--input", "-"], {
      input: JSON.stringify({
        tag_name: version,
        name: `Inline Annotation ${version}`,
        body: readFileSync(resolve(root, "RELEASE_NOTES.md"), "utf8"),
        draft: true,
      }),
    }));
}
assert.ok(release, `Cannot locate release ${version} after creation`);
assert.equal(release.tag_name, version);
assert.ok(Number.isSafeInteger(release.id), "Release must have a numeric ID");
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
    run("gh", ["api", "--method", "POST",
      `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      "-H", "Content-Type: application/octet-stream", "--input", path]);
  }
}
run("gh", ["api", "--method", "PATCH", `repos/${repo}/releases/${release.id}`,
  "-F", "draft=false", "-f", "make_latest=true", "--silent"]);
