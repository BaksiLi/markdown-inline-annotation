import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { npm, root, run } from "../../scripts/lib.mjs";

const library = "Library/BaksiLi";
const source = resolve(root, "plugins/silverbullet/space", library);
const artifacts = resolve(root, "artifacts/silverbullet");
const archiveName = "inline-annotation-silverbullet-trial.zip";
// Keep ZIP timestamps independent of when a release candidate is built.
const archiveTimestamp = new Date("2000-01-01T00:00:00Z");
const files = [
  [resolve(source, "Inline Annotation.md"), "Inline Annotation.md", "silverbullet-library.md"],
  [resolve(source, "inline-annotation-demo.md"), "inline-annotation-demo.md"],
  [resolve(source, "inline-annotation.js"), "inline-annotation.js"],
  [resolve(root, "packages/markdown-it/dist/core.mjs"), "inline-annotation-core.js"],
  [resolve(root, "LICENSE"), "inline-annotation-LICENSE.txt"],
];

run(npm, ["run", "build", "--workspace", "packages/markdown-it"]);

const stage = mkdtempSync(resolve(tmpdir(), "inline-annotation-silverbullet-"));
try {
  const space = resolve(stage, "space");
  mkdirSync(resolve(space, library), { recursive: true });
  for (const [path, name] of files) {
    const staged = resolve(space, library, name);
    copyFileSync(path, staged);
    utimesSync(staged, archiveTimestamp, archiveTimestamp);
  }
  const archive = resolve(stage, archiveName);
  const entries = files.map(([, name]) => library + "/" + name);
  run("zip", ["-q", "-X", archive, ...entries], { cwd: space, env: { ...process.env, TZ: "UTC" } });

  mkdirSync(artifacts, { recursive: true });
  copyFileSync(archive, resolve(artifacts, archiveName));
  for (const [path, name, assetName = name] of files) {
    copyFileSync(path, resolve(artifacts, assetName));
  }
  console.log(artifacts);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
