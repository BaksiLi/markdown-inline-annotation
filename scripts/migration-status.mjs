import { capture } from "./lib.mjs";
import { downloadStats } from "./download-stats.mjs";

const home = "baksili/markdown-inline-annotation";
const github = async (endpoint, paginate = false) => {
  const data = JSON.parse(capture("gh",
    ["api", endpoint, ...(paginate ? ["--paginate", "--slurp"] : [])],
    { timeout: 30000 }));
  return paginate ? data.flat() : data;
};
console.log(`Reach (queried ${new Date().toISOString()})`);
for (const result of await downloadStats(github)) {
  console.log(`${result.source}: ${result.error ? `unavailable (${result.error})` : result.text}`);
  if (result.error) process.exitCode = 1;
}
console.log("Downloads include repeat downloads, updates, and automation; these are not unique users.");
console.log("Platform counters use different definitions and refresh times; no cross-platform total is reported.\n");

const canonical = JSON.parse(capture("gh", ["api", `repos/${home}`]));
console.log(`Home: ${canonical.full_name} (repository ${canonical.id})`);
console.log(`Community: ${canonical.stargazers_count} stars; ${canonical.forks_count} forks`);
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
  ["Obsidian legacy index", obsidian.find((item) => item.id === "inline-annotation")],
  ["Logseq", logseq.packages.find((item) => item.id === "logseq-furigana-ruby")],
]) {
  if (!entry) {
    console.log(`${host}: not present in this index; verify the live directory separately`);
    continue;
  }
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
console.log("Obsidian's live listing and review can advance before the legacy index.");
console.log("Obsidian listing: https://community.obsidian.md/plugins/inline-annotation");
console.log("Review status: https://community.obsidian.md/account/plugins/inline-annotation");
