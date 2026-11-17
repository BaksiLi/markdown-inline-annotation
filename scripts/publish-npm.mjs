import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { npm, readJson, root, run } from "./lib.mjs";

const version = readJson("package.json").version;
assert.equal(process.env.GITHUB_REF_NAME, version);
assert.equal(process.env.GITHUB_REF_TYPE, "tag");
const name = "markdown-it-inline-annotation";
const archive = `${root}/artifacts/${name}-${version}.tgz`;
const expected = `sha512-${createHash("sha512").update(readFileSync(archive)).digest("base64")}`;
const result = spawnSync(npm, ["view", `${name}@${version}`, "dist.integrity", "--json"],
  { encoding: "utf8" });
if (result.status === 0) {
  assert.equal(JSON.parse(result.stdout), expected, "Existing npm version differs from the verified archive");
  console.log(`${name}@${version} already published with matching integrity`);
} else {
  assert.match(result.stderr, /E404/, "Registry lookup failed; refusing to assume version is absent");
  run(npm, ["publish", archive, "--access", "public", "--provenance"]);
}
