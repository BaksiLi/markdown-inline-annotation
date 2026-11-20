import assert from "node:assert/strict";
import test from "node:test";
import { createObsidianWindow } from "./obsidian-dom";
import fixtureCorpus from "markdown-it-inline-annotation/fixtures/html-render.json";
import segmentBoundaryCorpus from "markdown-it-inline-annotation/fixtures/segment-boundaries.json";
import { renderInlineAnnotationsInElement } from "../src/postprocessor";

interface FixtureCorpus {
  cases: Array<{
    id: string;
    assertionType?: "semantic" | "rendering-policy" | "host-skip";
    input: string;
    options?: { spaceAlignment?: string };
    contains?: string[];
    notContains?: string[];
    counts?: Array<{ pattern: string; count: number }>;
  }>;
}

interface SegmentBoundaryCorpus {
  cases: Array<{
    id: string;
    expectation: "must-render" | "may-render" | "must-preserve";
    runs: Array<{
      kind: "plain" | "transparent" | "strong" | "emphasis" | "mark" | "link" | "code";
      text: string;
    }>;
  }>;
}

function createRoot(html = ""): HTMLElement {
  const window = createObsidianWindow();
  const root = window.document.createElement("div");
  root.innerHTML = html;
  window.document.body.append(root);
  return root;
}

function createTextRoot(input: string): HTMLElement {
  const root = createRoot("<p></p>");
  const paragraph = root.querySelector("p");
  assert.ok(paragraph);
  paragraph.textContent = input;
  return root;
}

function createBoundaryRoot(fixture: SegmentBoundaryCorpus["cases"][number]): HTMLElement {
  const root = createRoot("<p></p>");
  const paragraph = root.querySelector("p");
  assert.ok(paragraph);

  for (const run of fixture.runs) {
    if (run.kind === "plain") {
      paragraph.append(root.ownerDocument.createTextNode(run.text));
      continue;
    }
    const tags = {
      transparent: "span",
      strong: "strong",
      emphasis: "em",
      mark: "mark",
      link: "a",
      code: "code",
    } as const;
    const element = root.ownerDocument.createElement(tags[run.kind]);
    if (run.kind === "link") element.setAttribute("href", "https://example.com");
    element.textContent = run.text;
    paragraph.append(element);
  }
  return root;
}

function assertContains(html: string, parts: string[] = []): void {
  for (const part of parts) {
    const domSerializedPart = part.replace(/&quot;/g, "\"");
    assert.ok(html.includes(part) || html.includes(domSerializedPart), `Missing ${part} in ${html}`);
  }
}

function assertNotContains(html: string, parts: string[] = []): void {
  for (const part of parts) assert.ok(!html.includes(part), `Unexpected ${part} in ${html}`);
}

for (const fixture of (fixtureCorpus as FixtureCorpus).cases) {
  const skip = fixture.assertionType === "host-skip" ? "host-specific fixture" :
    fixture.assertionType === "rendering-policy" && fixture.options?.spaceAlignment !== "auto" ? "Obsidian uses auto alignment" : undefined;
  test(fixture.id, { skip }, () => {
    const root = createTextRoot(fixture.input);
    renderInlineAnnotationsInElement(root);
    const html = root.innerHTML;
    assertContains(html, fixture.contains);
    assertNotContains(html, fixture.notContains);
    for (const { pattern, count } of fixture.counts ?? []) {
      assert.equal(html.split(pattern).length - 1, count, html);
    }
  });
}

test("groups ordinary word glosses", () => {
  const root = createTextRoot("[真值]^^(Truth Value)");
  renderInlineAnnotationsInElement(root);
  const html = root.innerHTML;

  assert.ok(html.includes("<rt>Truth Value</rt>"));
  assert.equal(html.split("<rt>").length - 1, 1);
});

test("aligns kana per character and hides matching readings", () => {
  const root = createTextRoot("[取り返す]^^(と り かえ す)");
  renderInlineAnnotationsInElement(root);
  const html = root.innerHTML;

  assert.ok(html.includes("<rt>と</rt>"));
  assert.ok(html.includes("り<rp>(</rp><rt></rt>"));
  assert.ok(html.includes("<rt>かえ</rt>"));
  assert.ok(html.includes("す<rp>(</rp><rt></rt>"));
  assert.equal(html.split("<ruby").length - 1, 4);
});

test("preserves inline code and links while rendering adjacent text", () => {
  const root = createRoot("<p><code></code> <a href=\"https://example.com\"></a> <span></span></p>");
  root.querySelector("code")!.textContent = "[code]^^(ann)";
  root.querySelector("a")!.textContent = "[link]^^(ann)";
  root.querySelector("span")!.textContent = "[text]^^(ann)";

  const stats = renderInlineAnnotationsInElement(root);
  const html = root.innerHTML;

  assert.equal(stats.replacements, 1);
  assert.ok(html.includes("<code>[code]^^(ann)</code>"));
  assert.ok(html.includes('<a href="https://example.com">[link]^^(ann)</a>'));
  assert.ok(html.includes("<rt>ann</rt>"));
});

test("preserves code blocks, ruby, and non-content elements", () => {
  const root = createRoot("<pre></pre><ruby></ruby><script></script><style></style><textarea></textarea>");
  root.querySelector("pre")!.textContent = "[pre]^^(ann)";
  root.querySelector("ruby")!.textContent = "[ruby]^^(ann)";
  root.querySelector("script")!.textContent = "[script]^^(ann)";
  root.querySelector("style")!.textContent = "[style]^^(ann)";
  root.querySelector("textarea")!.textContent = "[textarea]^^(ann)";

  const stats = renderInlineAnnotationsInElement(root);

  assert.equal(stats.replacements, 0);
  assert.ok(!root.innerHTML.includes("<rt>ann</rt>"));
});

test("honors the ignore attribute", () => {
  const root = createRoot("<p data-inline-annotation-ignore></p><p></p>");
  root.querySelectorAll("p")[0].textContent = "[ignored]^^(ann)";
  root.querySelectorAll("p")[1].textContent = "[rendered]^^(ann)";

  const stats = renderInlineAnnotationsInElement(root);
  const html = root.innerHTML;

  assert.equal(stats.replacements, 1);
  assert.ok(html.includes("[ignored]^^(ann)"));
  assert.ok(html.includes("<rt>ann</rt>"));
});

test("can be applied more than once", () => {
  const root = createTextRoot("[漢字]^^(かんじ)");

  assert.equal(renderInlineAnnotationsInElement(root).replacements, 1);
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 0);
  assert.equal(root.innerHTML.split("<ruby").length - 1, 1);
});

for (const fixture of (segmentBoundaryCorpus as SegmentBoundaryCorpus).cases) {
  test(fixture.id, () => {
    const root = createBoundaryRoot(fixture);
    const source = fixture.runs.map((run) => run.text).join("");
    renderInlineAnnotationsInElement(root);
    const html = root.innerHTML;

    if (fixture.expectation === "must-preserve") {
      assert.ok(!html.includes("ia-ruby"), `${fixture.id} must not render across a semantic boundary`);
      assert.equal(root.querySelector("p")?.textContent, source, `${fixture.id} source text must stay intact`);
      const semanticTags = { strong: "strong", emphasis: "em", mark: "mark", link: "a", code: "code" } as const;
      for (const run of fixture.runs) {
        if (!(run.kind in semanticTags)) continue;
        const element = root.querySelector(semanticTags[run.kind as keyof typeof semanticTags]);
        assert.equal(element?.textContent, run.text, `${fixture.id} must preserve the ${run.kind} run`);
      }
    } else {
      assert.ok(html.includes("ia-ruby"), `${fixture.id} should render under Obsidian's transparent-run policy`);
    }

    if (fixture.id === "boundary-single-formatted-run") {
      assert.ok(html.includes("<strong><ruby"), "a containing strong run must be preserved");
    }
  });
}

test("renders multiple fragmented expressions sharing a text run", () => {
  const root = createRoot("<p><span>[a]^</span><span>^(x) and [b]^^(</span><span>y) tail</span></p>");
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 2);
  assert.deepEqual(Array.from(root.querySelectorAll("rt"), (node) => node.textContent), ["x", "y"]);
  assert.equal(root.textContent, "a(x) and b(y) tail");
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 0);
});

test("retains the prefix run beside a complete annotation", () => {
  const root = createRoot("<p><span>[a]^^(</span><span>x) and [b]^^(y)</span></p>");
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 2);
  assert.deepEqual(Array.from(root.querySelectorAll("rt"), (node) => node.textContent), ["x", "y"]);
});

test("keeps a semantic boundary even when it has no text", () => {
  const root = createRoot("<p>[a]^^(<a href='/example'></a>x) [b]^^(y)</p>");
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 1);
  assert.equal(root.querySelector("rt")?.textContent, "y");
  assert.equal(root.querySelector("a")?.getAttribute("href"), "/example");
});

test("recovers the raw meaning of Markdown escapes in Reading view", () => {
  const source = String.raw`Literal [term]^^(a\|b) and [word]^^(\.-).`;
  const root = createTextRoot("Literal [term]^^(a|b) and [word]^^(.-).");
  assert.equal(renderInlineAnnotationsInElement(root, source).replacements, 1);
  assert.deepEqual(Array.from(root.querySelectorAll("rt"), (reading) => reading.textContent), ["a|b", ".-"]);
  assert.equal(root.querySelector(".ia-overline"), null);
});

test("recovers escaped slots beside named and numeric entities", () => {
  const source = "A &amp; B &#x1F680; [term]^^(left\\|right) and \\&amp; [word]^^(\\.-).";
  const root = createTextRoot("A & B 🚀 [term]^^(left|right) and &amp; [word]^^(.-).");
  assert.equal(renderInlineAnnotationsInElement(root, source).replacements, 1);
  assert.deepEqual(Array.from(root.querySelectorAll("rt"), (reading) => reading.textContent), ["left|right", ".-"]);
  assert.equal(root.textContent, "A & B 🚀 term(left|right) and &amp; word(.-).");
});

test("does not reinterpret entity-spelled annotation delimiters", () => {
  const source = "&#91;字&#93;^^(literal) and [term]^^(reading).";
  const root = createTextRoot("[字]^^(literal) and [term]^^(reading).");
  assert.equal(renderInlineAnnotationsInElement(root, source).replacements, 1);
  assert.equal(root.textContent, "[字]^^(literal) and term(reading).");
  assert.equal(root.querySelectorAll("ruby").length, 1);
});

test("keeps host-decoded backslashes in the surrounding text", () => {
  const path = "C:\\notes\\reading.md";
  const root = createRoot("<p><strong>" + path + " [字]^^(reading)</strong></p>");
  assert.equal(renderInlineAnnotationsInElement(root).replacements, 1);
  assert.equal(root.querySelector("strong")?.textContent, path + " 字(reading)");
});

test("does not resurrect quoted syntax or alter host-owned elements", () => {
  const literal = createTextRoot("[字]^^(reading)");
  assert.equal(renderInlineAnnotationsInElement(literal, String.raw`\[字\]\^^(reading)`).replacements, 0);
  assert.equal(literal.textContent, "[字]^^(reading)");

  const root = createRoot("<p><strong>[a]</strong>^^(b|c)</p>");
  assert.equal(renderInlineAnnotationsInElement(root, String.raw`**[a]**^^(b\|c)`).replacements, 0);
  assert.equal(root.querySelector("strong")?.textContent, "[a]");

  const ignored = createRoot("<p data-inline-annotation-ignore>[a]^^(b|c)</p>");
  assert.equal(renderInlineAnnotationsInElement(ignored, String.raw`[a]^^(b\|c)`).replacements, 0);
  assert.equal(ignored.textContent, "[a]^^(b|c)");
});
