import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { releaseAssetNames, verifyReleaseChecksums } from "./release-assets.mjs";

function fixture(t) {
  const directory = mkdtempSync(resolve(tmpdir(), "inline-annotation-checksums-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const entries = releaseAssetNames("0.8.2").filter((name) => name !== "SHA256SUMS");
  const sums = entries.map((name) => {
    const content = `published ${name}\n`;
    writeFileSync(resolve(directory, name), content);
    return `${createHash("sha256").update(content).digest("hex")}  ${name}`;
  });
  writeFileSync(resolve(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
  return { directory, sums };
}

test("accepts the complete published bundle", (t) => {
  verifyReleaseChecksums(fixture(t).directory, "0.8.2");
});

test("rejects a modified artifact before publishing", (t) => {
  const { directory } = fixture(t);
  writeFileSync(resolve(directory, "main.js"), "different build");
  assert.throws(() => verifyReleaseChecksums(directory, "0.8.2"), /Checksum mismatch for main.js/);
});

test("rejects an extra ZIP that could confuse Logseq", (t) => {
  const { directory } = fixture(t);
  writeFileSync(resolve(directory, "another.zip"), "unexpected");
  assert.throws(() => verifyReleaseChecksums(directory, "0.8.2"), /Release asset set differs/);
});

test("rejects incomplete checksums", (t) => {
  const { directory, sums } = fixture(t);
  writeFileSync(resolve(directory, "SHA256SUMS"), `${sums.slice(1).join("\n")}\n`);
  assert.throws(() => verifyReleaseChecksums(directory, "0.8.2"), /must cover every asset/);
});

test("rejects duplicate checksum entries", (t) => {
  const { directory, sums } = fixture(t);
  writeFileSync(resolve(directory, "SHA256SUMS"), `${sums.concat(sums[0]).join("\n")}\n`);
  assert.throws(() => verifyReleaseChecksums(directory, "0.8.2"), /Duplicate filename/);
});

test("rejects filenames outside the release bundle", (t) => {
  const { directory, sums } = fixture(t);
  writeFileSync(resolve(directory, "SHA256SUMS"), `${sums.join("\n")}\n${"0".repeat(64)}  ../main.js\n`);
  assert.throws(() => verifyReleaseChecksums(directory, "0.8.2"), /Unexpected filename/);
});


test("retains the original bundle on retry and includes Marked in subsequent releases", () => {
  assert.ok(!releaseAssetNames("0.8.4").includes("marked-inline-annotation-0.8.4.tgz"));
  for (const version of ["0.8.5", "0.8.10", "0.9.0", "1.0.0"]) {
    assert.ok(releaseAssetNames(version).includes(`marked-inline-annotation-${version}.tgz`));
  }
});
