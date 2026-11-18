import assert from "node:assert/strict";

const packageName = "markdown-it-inline-annotation";
const extensionId = "baksili.vscode-inline-annotation";

function count(value, label) {
  assert.ok(Number.isSafeInteger(value) && value >= 0, `Missing or invalid ${label}`);
  return value;
}

export function npmDownloadRanges(start, end) {
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  assert.ok(Number.isFinite(+cursor) && Number.isFinite(+last) && cursor <= last,
    "Invalid npm download period");
  const ranges = [];
  while (cursor <= last) {
    const stop = new Date(Math.min(+cursor + 364 * 86400000, +last));
    ranges.push([cursor.toISOString().slice(0, 10), stop.toISOString().slice(0, 10)]);
    cursor.setTime(+stop + 86400000);
  }
  return ranges;
}

export function logseqDownloadCount(releases) {
  return releases.filter((release) => !release.draft).reduce((total, release) =>
    total + release.assets
      .filter((asset) => asset.name === "logseq-furigana-ruby.zip")
      .reduce((subtotal, asset) =>
        subtotal + count(asset.download_count, "Logseq ZIP downloads"), 0), 0);
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

export function aggregateDownloads(stats) {
  const available = stats.filter((item) => item.error === undefined);
  return {
    downloads: available.reduce((total, item) =>
      total + count(item.downloads, `${item.source} downloads`), 0),
    availableSources: available.length,
    totalSources: stats.length,
  };
}

export async function downloadStats(github, getJson = fetchJson) {
  const sources = [
    ["Obsidian", async () => {
      const stats = await getJson(
        "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json");
      const downloads = count(stats["inline-annotation"]?.downloads, "Obsidian downloads");
      return { downloads, text: `${downloads.toLocaleString("en-US")} downloads (official cumulative count)` };
    }],
    ["npm", async () => {
      const [metadata, month] = await Promise.all([
        getJson(`https://registry.npmjs.org/${packageName}`),
        getJson(`https://api.npmjs.org/downloads/point/last-month/${packageName}`),
      ]);
      const monthly = count(month.downloads, "npm monthly downloads");
      const start = metadata.time.created.slice(0, 10);
      const periods = await Promise.all(npmDownloadRanges(start, month.end).map(
        ([from, to]) => getJson(
          `https://api.npmjs.org/downloads/point/${from}:${to}/${packageName}`)));
      const total = periods.reduce((sum, period) =>
        sum + count(period.downloads, "npm period downloads"), 0);
      return { downloads: total, text: `${total.toLocaleString("en-US")} downloads since ${start} through ${month.end}; ${monthly.toLocaleString("en-US")} in ${month.start} to ${month.end}` };
    }],
    ["VS Code", async () => {
      const data = await getJson(
        "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json;api-version=7.2-preview.1",
          },
          body: JSON.stringify({
            filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
            flags: 256,
          }),
        });
      const extension = data.results?.flatMap((result) => result.extensions ?? [])
        .find((item) => `${item.publisher.publisherName}.${item.extensionName}` === extensionId);
      const stats = new Map(extension?.statistics?.map(
        (item) => [item.statisticName, item.value]));
      const downloads = count(stats.get("downloadCount"), "Marketplace downloads");
      return { downloads, text: `${downloads.toLocaleString("en-US")} downloads; ${count(stats.get("install"), "Marketplace installs").toLocaleString("en-US")} installs (separate Marketplace metrics)` };
    }],
    ["Logseq", async () => {
      const [previous, current] = await Promise.all([
        github("repos/BaksiLi/logseq-furigana-ruby/releases?per_page=100", true),
        github("repos/BaksiLi/markdown-inline-annotation/releases?per_page=100", true),
      ]);
      const oldCount = logseqDownloadCount(previous);
      const newCount = logseqDownloadCount(current);
      const downloads = oldCount + newCount;
      return { downloads, text: `${downloads.toLocaleString("en-US")} ZIP downloads (${oldCount} original repo + ${newCount} current repo)` };
    }],
  ];
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  return results.map((result, index) => result.status === "fulfilled"
    ? { source: sources[index][0], ...result.value }
    : { source: sources[index][0], error: result.reason.message });
}
