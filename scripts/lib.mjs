import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const workspaces = [
  "packages/markdown-it",
  "plugins/logseq",
  "plugins/obsidian",
  "plugins/vscode",
  "packages/satteri",
];
export const npm = process.platform === "win32" ? "npm.cmd" : "npm";
export function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}
export function writeJson(path, value) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}
export function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.error}`);
  return result;
}
export function capture(command, args, options = {}) {
  const result = spawnSync(command, args,
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr || result.error}`);
  return result.stdout.trim();
}
