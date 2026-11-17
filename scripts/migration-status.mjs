import { capture } from "./lib.mjs";

const home = "baksili/markdown-inline-annotation";
const canonical = JSON.parse(capture("gh", ["api", `repos/${home}`]));
console.log(`Home: ${canonical.full_name} (repository ${canonical.id})`);
const old = ["markdown-it-inline-annotation", "obsidian-inline-annotation",
  "logseq-furigana-ruby", "vscode-inline-annotation"];
for (const name of old) {
  const repo = JSON.parse(capture("gh", ["api", `repos/BaksiLi/${name}`]));
  const state = repo.id === canonical.id
    ? "renamed to the monorepo; original repository identity preserved"
    : repo.archived ? "archived" : "active";
  console.log(`${name}: ${state}`);
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
  let state = ready ? "migrated" : "registry migration pending";
  if (!ready && entry?.repo) {
    const target = JSON.parse(capture("gh", ["api", `repos/${entry.repo}`]));
    if (target.id === canonical.id) {
      state = "same repository via redirect; canonical directory path pending";
    }
  }
  console.log(`${host}: ${entry?.repo ?? "not found"} (${state})`);
}
