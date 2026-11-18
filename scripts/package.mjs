import { cpSync, mkdirSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { resolve } from "node:path";
import { capture, npm, readJson, root, run, writeJson } from "./lib.mjs";

const version = readJson("package.json").version;
const artifacts = resolve(root, "artifacts");
const stage = resolve(root, ".release-stage");
const epoch = capture("git", ["log", "-1", "--format=%ct"]);
const timestamp = new Date(Number(epoch) * 1000);
rmSync(artifacts, { recursive: true, force: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(artifacts);
mkdirSync(stage);
for (const workspace of ["packages/markdown-it", "packages/marked"]) {
  run(npm, ["pack", "--workspace", workspace, "--pack-destination", artifacts]);
}
const core = `markdown-it-inline-annotation-${version}.tgz`;

for (const name of ["main.js", "manifest.json", "styles.css"]) {
  cpSync(resolve(root, "plugins/obsidian", name), resolve(artifacts, name));
}
const logseq = resolve(stage, "logseq");
mkdirSync(logseq);
for (const name of ["dist", "package.json", "manifest.json", "icon.png", "README.md", "LICENSE"]) {
  cpSync(resolve(root, "plugins/logseq", name), resolve(logseq, name), { recursive: true });
}
function archiveFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const relative = `${prefix}${entry.name}`;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return archiveFiles(path, `${relative}/`);
      utimesSync(path, timestamp, timestamp);
      return [relative];
    });
}
run("zip", ["-q", "-X", resolve(artifacts, "logseq-furigana-ruby.zip"), ...archiveFiles(logseq)],
  { cwd: logseq, env: { ...process.env, TZ: "UTC" } });

// VSCE needs a real dependency tree; workspace symlinks are not portable in a VSIX.
const vscode = resolve(stage, "vscode");
mkdirSync(vscode);
for (const name of ["dist", "README.md", "LICENSE", "CHANGELOG.md", ".vscodeignore"]) {
  cpSync(resolve(root, "plugins/vscode", name), resolve(vscode, name), { recursive: true });
}
const pkg = readJson("plugins/vscode/package.json");
delete pkg.devDependencies;
delete pkg.scripts;
writeJson(".release-stage/vscode/package.json", pkg);
run(npm, ["install", "--omit=dev", "--ignore-scripts", "--no-save", "--no-package-lock", "--no-audit", "--no-fund",
  "--offline", resolve(artifacts, core)], { cwd: vscode });
run(process.execPath, [resolve(root, "node_modules/@vscode/vsce/vsce"), "package",
  "--out", resolve(artifacts, `vscode-inline-annotation-${version}.vsix`)],
  { cwd: vscode, env: { ...process.env, SOURCE_DATE_EPOCH: epoch } });
run(process.execPath, ["scripts/verify-artifacts.mjs"]);
