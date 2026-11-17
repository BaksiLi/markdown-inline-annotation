import { capture } from "./lib.mjs";

const home = "baksili/markdown-inline-annotation";
const old = ["markdown-it-inline-annotation", "obsidian-inline-annotation",
  "logseq-furigana-ruby", "vscode-inline-annotation"];
for (const name of old) {
  const repo = JSON.parse(capture("gh", ["api", `repos/BaksiLi/${name}`]));
  console.log(`${name}: ${repo.archived ? "archived" : "active"}`);
}
const obsidian = JSON.parse(capture("gh", ["api",
  "repos/obsidianmd/obsidian-releases/contents/community-plugins.json",
  "-H", "Accept: application/vnd.github.raw+json"]));
const logseq = JSON.parse(capture("gh", ["api",
  "repos/logseq/marketplace/contents/plugins.json",
  "-H", "Accept: application/vnd.github.raw+json"]));
for (const [host, entry] of [
  ["Obsidian", obsidian.find((item) => item.id === "inline-annotation")],
  ["Logseq", logseq.packages.find((item) => item.id === "logseq-furigana-ruby")],
]) {
  const ready = entry?.repo?.toLowerCase() === home;
  console.log(`${host}: ${entry?.repo ?? "not found"} (${ready ? "migrated" : "registry migration pending"})`);
}
