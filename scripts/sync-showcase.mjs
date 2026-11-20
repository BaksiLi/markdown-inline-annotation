import { readFileSync, writeFileSync } from "node:fs";
import { readJson, root } from "./lib.mjs";

const examples = readJson("docs/examples/showcase.json");
const check = process.argv.includes("--check");
if (!Array.isArray(examples) || !examples.length ||
    examples.some((source) => typeof source !== "string" || !source.trim() || /[\r\n]/.test(source))) {
  throw new Error("Each shared showcase entry must be one nonempty line");
}

for (const { file, indent, prefix, separator } of [
  { file: "plugins/obsidian/examples/obsidian-showcase.md", indent: "", prefix: "", separator: "\n\n" },
  { file: "plugins/logseq/examples/logseq-smoke.md", indent: "  ", prefix: "  - ", separator: "\n" },
]) {
  const path = `${root}/${file}`;
  const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const begin = `${indent}<!-- BEGIN SHARED SHOWCASE -->\n`;
  const end = `${indent}<!-- END SHARED SHOWCASE -->`;
  const startAt = source.indexOf(begin);
  const endAt = source.indexOf(end, startAt + begin.length);
  if (startAt === -1 || endAt === -1) throw new Error(`Missing showcase markers in ${file}`);

  const body = examples.map((example) => prefix + example).join(separator);
  const expected = source.slice(0, startAt + begin.length) + body + "\n" + source.slice(endAt);
  if (expected === source) continue;
  if (check) throw new Error(`${file} is out of date. Run npm run examples:sync.`);
  writeFileSync(path, expected);
}
