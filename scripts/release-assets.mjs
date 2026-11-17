import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function releaseAssetNames(version) {
  assert.match(version, /^\d+\.\d+\.\d+$/, "Expected a bare release version");
  return [
    "logseq-furigana-ruby.zip",
    "main.js",
    "manifest.json",
    `markdown-it-inline-annotation-${version}.tgz`,
    "SHA256SUMS",
    "styles.css",
    `vscode-inline-annotation-${version}.vsix`,
  ].sort();
}

export function verifyReleaseChecksums(directory, version) {
  const names = releaseAssetNames(version);
  assert.deepEqual(readdirSync(directory).sort(), names, "Release asset set differs");
  const expected = names.filter((name) => name !== "SHA256SUMS");
  const checksums = new Map();
  for (const line of readFileSync(resolve(directory, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, "Invalid SHA256SUMS entry");
    assert.ok(expected.includes(match[2]), "Unexpected filename in SHA256SUMS");
    assert.ok(!checksums.has(match[2]), "Duplicate filename in SHA256SUMS");
    checksums.set(match[2], match[1]);
  }
  assert.deepEqual([...checksums.keys()].sort(), expected, "SHA256SUMS must cover every asset");
  for (const [name, checksum] of checksums) {
    const actual = createHash("sha256").update(readFileSync(resolve(directory, name))).digest("hex");
    assert.equal(actual, checksum, `Checksum mismatch for ${name}`);
  }
}
