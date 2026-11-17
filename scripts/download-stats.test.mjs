import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadStats, logseqDownloadCount, npmDownloadRanges } from "./download-stats.mjs";

test("npm lifetime periods cover leap years without gaps, overlap, or oversized requests", () => {
  const ranges = npmDownloadRanges("2024-02-28", "2026-05-29");
  assert.equal(ranges[0][0], "2024-02-28");
  assert.equal(ranges.at(-1)[1], "2026-05-29");
  for (const [index, [start, end]] of ranges.entries()) {
    assert.ok((Date.parse(end) - Date.parse(start)) / 86400000 < 365);
    if (index) assert.equal(Date.parse(start) - Date.parse(ranges[index - 1][1]), 86400000);
  }
  assert.deepEqual(npmDownloadRanges("2026-05-29", "2026-05-29"),
    [["2026-05-29", "2026-05-29"]]);
  assert.throws(() => npmDownloadRanges("2026-05-30", "2026-05-29"));
});

test("Logseq counts only its ZIP, ignoring Obsidian files, VSIXs, and drafts", () => {
  assert.equal(logseqDownloadCount([
    { assets: [
      { name: "logseq-furigana-ruby.zip", download_count: 7 },
      { name: "main.js", download_count: 100 },
      { name: "extension.vsix", download_count: 50 },
    ] },
    { draft: true, assets: [{ name: "logseq-furigana-ruby.zip", download_count: 3 }] },
  ]), 7);
  assert.throws(() => logseqDownloadCount([
    { assets: [{ name: "logseq-furigana-ruby.zip" }] },
  ]), /invalid/);
});

test("a failed source stays unavailable while other counts retain their own units", async () => {
  const github = async () => [
    { assets: [{ name: "logseq-furigana-ruby.zip", download_count: 5 }] },
  ];
  const getJson = async (url, options) => {
    if (url.includes("community-plugin-stats")) throw new Error("source unavailable");
    if (url.includes("registry.npmjs")) return { time: { created: "2026-05-29T00:00:00Z" } };
    if (url.includes("last-month")) return { downloads: 30, start: "2026-06-01", end: "2026-06-30" };
    if (url.includes("downloads/point")) return { downloads: 100 };
    assert.equal(options.method, "POST");
    return { results: [{ extensions: [{
      publisher: { publisherName: "baksili" }, extensionName: "vscode-inline-annotation",
      statistics: [{ statisticName: "install", value: 2 }, { statisticName: "downloadCount", value: 288 }],
    }] }] };
  };
  const stats = await downloadStats(github, getJson);
  assert.equal(stats[0].error, "source unavailable");
  assert.match(stats[1].text, /^100 downloads since 2026-05-29 through 2026-06-30; 30 in/);
  assert.match(stats[2].text, /^288 downloads; 2 installs/);
  assert.equal(stats[3].text, "10 ZIP downloads (5 original repo + 5 current repo)");
});

test("an absent official counter is an error rather than a misleading zero", async () => {
  const stats = await downloadStats(async () => [], async () => ({}));
  assert.match(stats.find((item) => item.source === "Obsidian").error, /invalid Obsidian/);
  assert.match(stats.find((item) => item.source === "VS Code").error, /invalid Marketplace/);
});
