import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    clean: { type: "boolean" },
    enable: { type: "boolean" },
    examples: { type: "boolean" },
    "examples-dir": { type: "string" },
  },
});
const { clean, enable, examples, "examples-dir": examplesDir } = values;
const targetArg = positionals[0] ?? process.env.OBSIDIAN_VAULT;

if (!targetArg || positionals.length > 1) {
  console.error(
    "Usage: npm run install:vault -- <vault path | plugins path | plugin path> [--clean] [--enable] [--examples | --examples-dir <vault-relative path>]"
  );
  process.exit(1);
}

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const targetRoot = path.resolve(targetArg);
const pluginDir = resolvePluginDir(targetRoot);
const vaultDir = resolveVaultDir(pluginDir);
const files = ["main.js", "manifest.json", "versions.json", "styles.css"];
const exampleTarget = examples || examplesDir !== undefined
  ? resolveExamplesDir(vaultDir, examplesDir ?? ".")
  : undefined;

if (clean && existsSync(pluginDir)) {
  rmSync(pluginDir, { recursive: true, force: true });
}

mkdirSync(pluginDir, { recursive: true });

for (const file of files) {
  cpSync(path.join(sourceRoot, file), path.join(pluginDir, file));
}

if (enable) enablePlugin(vaultDir);
if (exampleTarget) installExamples(exampleTarget);

console.log(`Installed ${manifest.id} to ${pluginDir}`);
if (enable) console.log(`Enabled ${manifest.id} in ${path.join(vaultDir, ".obsidian", "community-plugins.json")}`);
if (exampleTarget) console.log(`Installed examples to ${exampleTarget}`);

function resolvePluginDir(target) {
  if (existsSync(path.join(target, "manifest.json"))) return target;
  if (path.basename(target) === manifest.id) return target;
  if (path.basename(target) === "plugins" && path.basename(path.dirname(target)) === ".obsidian") {
    return path.join(target, manifest.id);
  }
  if (path.basename(target) === ".obsidian") return path.join(target, "plugins", manifest.id);
  return path.join(target, ".obsidian", "plugins", manifest.id);
}

function resolveVaultDir(pluginDir) {
  const pluginsDir = path.dirname(pluginDir);
  const obsidianDir = path.dirname(pluginsDir);
  if (path.basename(pluginsDir) !== "plugins" || path.basename(obsidianDir) !== ".obsidian") {
    throw new Error(`Cannot resolve Obsidian vault from plugin directory: ${pluginDir}`);
  }
  return path.dirname(obsidianDir);
}

function enablePlugin(vaultDir) {
  const configPath = path.join(vaultDir, ".obsidian", "community-plugins.json");
  let plugins = [];
  if (existsSync(configPath)) {
    plugins = JSON.parse(readFileSync(configPath, "utf8"));
    if (!Array.isArray(plugins)) throw new Error(`${configPath} must contain a JSON array`);
  }
  if (!plugins.includes(manifest.id)) {
    plugins.push(manifest.id);
    writeFileSync(configPath, `${JSON.stringify(plugins, null, 2)}\n`);
  }
}

function resolveExamplesDir(vaultDir, directory) {
  const target = path.resolve(vaultDir, directory);
  const relative = path.relative(vaultDir, target);
  if (path.isAbsolute(directory) || relative.split(path.sep)[0] === "..") {
    throw new Error("--examples-dir must be relative to the vault");
  }
  return target;
}

function installExamples(target) {
  mkdirSync(target, { recursive: true });
  for (const name of ["smoke", "showcase"]) {
    cpSync(path.join(sourceRoot, "examples", `obsidian-${name}.md`), path.join(target, `inline-annotation ${name}.md`));
  }
}
