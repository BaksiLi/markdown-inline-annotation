import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { capture, readJson, root, run } from "./lib.mjs";
import { releaseAssetNames, verifyReleaseChecksums } from "./release-assets.mjs";

const version = readJson("package.json").version;
assert.equal(process.env.RELEASE_TAG, version, "Resume the current shared release version");
const repo = "BaksiLi/markdown-inline-annotation";
const release = JSON.parse(capture("gh", ["api", `repos/${repo}/releases/tags/${version}`]));
assert.equal(release.tag_name, version);
assert.equal(release.draft, false, "Only resume an already public release");
assert.equal(release.prerelease, false);
assert.deepEqual(release.assets.map((asset) => asset.name).sort(), releaseAssetNames(version));
const directory = resolve(process.argv[2] ?? `${root}/artifacts`);
mkdirSync(directory, { recursive: true });
assert.equal(readdirSync(directory).length, 0, "Download into an empty artifact directory");
run("gh", ["release", "download", version, "--repo", repo, "--dir", directory]);
verifyReleaseChecksums(directory, version);
for (const asset of release.assets) {
  const digest = `sha256:${createHash("sha256").update(readFileSync(resolve(directory, asset.name))).digest("hex")}`;
  assert.equal(digest, asset.digest, `GitHub digest mismatch for ${asset.name}`);
}
console.log(`Downloaded the original ${version} assets; checksums and GitHub digests match.`);
