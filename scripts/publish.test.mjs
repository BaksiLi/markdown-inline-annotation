import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const fakeGh = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.RELEASE_TEST_STATE, "utf8"));
state.calls.push(args);
const save = () => fs.writeFileSync(process.env.RELEASE_TEST_STATE, JSON.stringify(state));
if (args[0] === "api" && args.includes("--slurp")) {
  save();
  if (state.lookupFails) { console.error("HTTP 403"); process.exit(1); }
  process.stdout.write(JSON.stringify([state.release && !state.hideCreatedRelease ? [state.release] : []]));
} else if (args[0] === "api" && args[1].includes("/git/ref/tags/")) {
  save();
  process.stdout.write(JSON.stringify({ ref: "refs/tags/0.8.1" }));
} else if (args.includes("POST") && args.some(x => x.endsWith("/releases"))) {
  const body = JSON.parse(fs.readFileSync(0, "utf8"));
  state.release = { id: 123, tag_name: body.tag_name, draft: body.draft, assets: [] };
  save();
  process.stdout.write(JSON.stringify(state.release));
} else if (args.includes("POST") && args.some(x => x.startsWith("https://uploads.github.com/"))) {
  const path = args[args.indexOf("--input") + 1];
  const name = new URL(args.find(x => x.startsWith("https://"))).searchParams.get("name");
  state.release.assets.push({ id: name, name });
  state.bytes[name] = fs.readFileSync(path).toString("base64");
  save();
} else if (args[0] === "api" && args[1].includes("/releases/assets/")) {
  save();
  process.stdout.write(Buffer.from(state.bytes[args[1].split("/").pop()], "base64"));
} else if (args.includes("PATCH")) {
  state.release.draft = false;
  save();
} else {
  save();
  console.error("Unexpected gh call", args);
  process.exit(1);
}
`;

function fixture(t, overrides = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), "inline-annotation-publish-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ["scripts", "artifacts", "bin"]) {
    mkdirSync(resolve(directory, name));
  }
  for (const name of ["publish.mjs", "lib.mjs"]) {
    copyFileSync(new URL(name, import.meta.url), resolve(directory, "scripts", name));
  }
  writeFileSync(resolve(directory, "package.json"), '{"version":"0.8.1"}');
  writeFileSync(resolve(directory, "RELEASE_NOTES.md"), "Release notes\\n");
  writeFileSync(resolve(directory, "artifacts", "SHA256SUMS"), "verified checksum\n");
  writeFileSync(resolve(directory, "artifacts", "main.js"), "verified build\n");
  writeFileSync(resolve(directory, "bin", "gh"), fakeGh, { mode: 0o755 });
  const statePath = resolve(directory, "state.json");
  writeFileSync(statePath, JSON.stringify({ calls: [], bytes: {}, ...overrides }));
  return {
    directory,
    read: () => JSON.parse(readFileSync(statePath, "utf8")),
    write: (state) => writeFileSync(statePath, JSON.stringify(state)),
    publish: () => spawnSync(process.execPath, [resolve(directory, "scripts", "publish.mjs")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${resolve(directory, "bin")}:${process.env.PATH}`,
        GITHUB_REF_TYPE: "tag",
        GITHUB_REF_NAME: "0.8.1",
        RELEASE_TEST_STATE: statePath,
      },
    }),
  };
}

test("creates and finds a draft, uploads assets, and safely retries a published release", (t) => {
  const f = fixture(t);
  const first = f.publish();
  assert.equal(first.status, 0, first.stderr);
  const before = f.read();
  assert.equal(before.release.draft, false);
  assert.equal(before.release.assets.length, 2);
  const second = f.publish();
  assert.equal(second.status, 0, second.stderr);
  const uploads = (state) => state.calls.filter((args) =>
    args.some((arg) => arg.startsWith("https://uploads.github.com/"))).length;
  assert.equal(uploads(f.read()), uploads(before));
});

test("resumes an existing draft without creating another release", (t) => {
  const f = fixture(t, { release: { id: 123, tag_name: "0.8.1", draft: true, assets: [] } });
  const result = f.publish();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read().calls.some((args) =>
    args.includes("POST") && args.some((arg) => arg.endsWith("/releases"))), false);
});

test("publishes using the creation response when a new draft is not discoverable yet", (t) => {
  const f = fixture(t, { hideCreatedRelease: true });
  const result = f.publish();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read().calls.filter((args) => args.includes("--slurp")).length, 1);
  assert.equal(f.read().release.draft, false);
});

test("refuses to replace an asset with different bytes", (t) => {
  const f = fixture(t);
  assert.equal(f.publish().status, 0);
  const state = f.read();
  state.bytes["main.js"] = Buffer.from("different build").toString("base64");
  state.calls = [];
  f.write(state);
  const result = f.publish();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /differs/);
  assert.equal(f.read().calls.some((args) => args.includes("POST") || args.includes("PATCH")), false);
});

test("fails closed on authentication errors instead of creating a release", (t) => {
  const f = fixture(t, { lookupFails: true });
  assert.notEqual(f.publish().status, 0);
  assert.equal(f.read().calls.some((args) => args.includes("POST") || args.includes("PATCH")), false);
});

test("refuses to publish a release containing an unexpected ZIP", (t) => {
  const f = fixture(t, {
    release: { id: 123, tag_name: "0.8.1", draft: true, assets: [{ id: 1, name: "wrong.zip" }] },
  });
  const result = f.publish();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected assets/);
  assert.equal(f.read().calls.some((args) => args.includes("PATCH")), false);
});
