const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const MarkdownIt = require("markdown-it");
const { assertRenderFixture } = require("../../scripts/assert-render-fixture.cjs");
const {
  inlineAnnotationPlugin,
  renderInlineAnnotationsToHtml,
  renderInlineAnnotationModelToHtml,
  findInlineAnnotation,
  findInlineAnnotationModel,
  findInlineAnnotationModels,
  findInlineAnnotationModelsBeforeMarkdown,
} = require("./dist/index.js");
const htmlRenderFixtureCorpus = require("./fixtures/html-render.json");
const modelFixtureCorpus = require("./fixtures/models.json");
const segmentBoundaryFixtureCorpus = require("./fixtures/segment-boundaries.json");
const packageManifest = require("./package.json");

function md(options) {
  return new MarkdownIt().use(inlineAnnotationPlugin, options);
}

function inline(input, options) {
  return md(options).render(input).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
}

function hasAll(value, parts) {
  for (const part of parts) assert.ok(value.includes(part), `Missing ${part} in ${value}`);
}

function hasNone(value, parts) {
  for (const part of parts) assert.ok(!value.includes(part), `Unexpected ${part} in ${value}`);
}

test("shared fixture corpus is well formed", () => {
  assert.equal(htmlRenderFixtureCorpus.version, 1);
  assert.deepEqual(Object.keys(htmlRenderFixtureCorpus.fixtureTypes).sort(), [
    "host-skip",
    "rendering-policy",
    "semantic",
  ]);
  assert.deepEqual(htmlRenderFixtureCorpus.fixtureSchema.commonRequired, [
    "id",
    "category",
    "name",
    "assertionType",
    "input",
  ]);
  assert.deepEqual(Object.keys(htmlRenderFixtureCorpus.fixtureSchema.byAssertionType).sort(), [
    "host-skip",
    "rendering-policy",
    "semantic",
  ]);
  assert.ok(Array.isArray(htmlRenderFixtureCorpus.cases));
  const ids = new Set();
  const allowedAssertionTypes = new Set(Object.keys(htmlRenderFixtureCorpus.fixtureTypes));
  for (const fixture of htmlRenderFixtureCorpus.cases) {
    for (const field of htmlRenderFixtureCorpus.fixtureSchema.commonRequired) {
      assert.ok(fixture[field], `fixture ${fixture.id || "(missing id)"} ${field} is required`);
    }
    assert.ok(!ids.has(fixture.id), `duplicate fixture id ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(
      allowedAssertionTypes.has(fixture.assertionType),
      `fixture ${fixture.id} assertionType must be one of ${[...allowedAssertionTypes].join(", ")}`
    );
    const typeSchema = htmlRenderFixtureCorpus.fixtureSchema.byAssertionType[fixture.assertionType];
    for (const field of typeSchema.required) {
      assert.ok(fixture[field], `fixture ${fixture.id} must declare ${field}`);
    }
    for (const field of typeSchema.forbidden) {
      assert.equal(fixture[field], undefined, `fixture ${fixture.id} must not declare ${field}`);
    }
    if (fixture.category === "alignment") {
      assert.equal(fixture.assertionType, "rendering-policy", `fixture ${fixture.id} must declare rendering-policy`);
    }
    if (fixture.assertionType === "host-skip") {
      assert.ok(
        Array.isArray(fixture.hostSkip) && fixture.hostSkip.length > 0,
        `fixture ${fixture.id} must declare hostSkip`
      );
    }
    assert.ok(typeof fixture.input === "string", `fixture ${fixture.id} input must be a string`);
    if (fixture.assertionType !== "host-skip") {
      assert.ok(
        (fixture.contains && fixture.contains.length > 0) ||
          (fixture.notContains && fixture.notContains.length > 0) ||
          (fixture.counts && fixture.counts.length > 0),
        `fixture ${fixture.id} needs at least one assertion`
      );
    }
    for (const count of fixture.counts || []) {
      assert.ok(count.pattern, `fixture ${fixture.id} count pattern is required`);
      assert.ok(Number.isInteger(count.count) && count.count >= 0, `fixture ${fixture.id} count must be a non-negative integer`);
    }
  }
});

test("segment boundary fixture corpus is well formed", () => {
  assert.equal(segmentBoundaryFixtureCorpus.version, 1);
  assert.deepEqual(Object.keys(segmentBoundaryFixtureCorpus.expectations).sort(), [
    "may-render",
    "must-preserve",
    "must-render",
  ]);
  const allowedKinds = new Set(Object.keys(segmentBoundaryFixtureCorpus.runKinds));
  const allowedExpectations = new Set(Object.keys(segmentBoundaryFixtureCorpus.expectations));
  const ids = new Set();

  for (const fixture of segmentBoundaryFixtureCorpus.cases) {
    assert.ok(fixture.id && fixture.name, "boundary fixture id and name are required");
    assert.ok(!ids.has(fixture.id), `duplicate boundary fixture id ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(allowedExpectations.has(fixture.expectation), `unknown expectation in ${fixture.id}`);
    assert.ok(Array.isArray(fixture.runs) && fixture.runs.length > 0, `${fixture.id} needs runs`);
    for (const run of fixture.runs) {
      assert.ok(allowedKinds.has(run.kind), `unknown run kind ${run.kind} in ${fixture.id}`);
      assert.ok(typeof run.text === "string" && run.text.length > 0, `${fixture.id} run text is required`);
    }

    const source = fixture.runs.map((run) => run.text).join("");
    assert.equal(
      findInlineAnnotationModels(source).length,
      1,
      `${fixture.id} must be valid when presented as one contiguous source segment`
    );
  }
});

test("model fixture corpus is well formed and matches the parser", () => {
  assert.equal(modelFixtureCorpus.version, 1);
  assert.equal(modelFixtureCorpus.offsetEncoding, "utf-16");
  assert.match(modelFixtureCorpus.rangeConvention, /zero-based/i);
  assert.match(modelFixtureCorpus.rangeConvention, /end-exclusive/i);
  assert.deepEqual(modelFixtureCorpus.fixtureSchema.required, [
    "id",
    "category",
    "name",
    "input",
    "models",
  ]);

  const ids = new Set();
  for (const fixture of modelFixtureCorpus.cases) {
    for (const field of modelFixtureCorpus.fixtureSchema.required) {
      assert.notEqual(fixture[field], undefined, `model fixture ${fixture.id || "(missing id)"} ${field} is required`);
    }
    assert.ok(!ids.has(fixture.id), `duplicate model fixture id ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(typeof fixture.input === "string", `model fixture ${fixture.id} input must be a string`);
    assert.ok(Array.isArray(fixture.models), `model fixture ${fixture.id} models must be an array`);

    const actual = findInlineAnnotationModels(
      fixture.input,
      0,
      fixture.input.length,
      fixture.options
    );
    assert.deepEqual(actual, fixture.models, `model fixture ${fixture.id} must match the core parser`);

    let previousEnd = 0;
    for (const model of fixture.models) {
      assert.ok(Number.isInteger(model.start) && Number.isInteger(model.end));
      assert.ok(model.start >= 0 && model.start <= model.end && model.end <= fixture.input.length);
      assert.ok(model.start >= previousEnd, `model fixture ${fixture.id} models must not overlap`);
      assert.equal(model.source, fixture.input.slice(model.start, model.end));
      for (const range of [model.base, ...model.slots, ...model.overflow]) {
        assert.ok(Number.isInteger(range.start) && Number.isInteger(range.end));
        assert.ok(range.start >= model.start && range.start <= range.end && range.end <= model.end);
        assert.equal(range.raw, fixture.input.slice(range.start, range.end));
      }
      previousEnd = model.end;
    }
  }
});

test("markdown-it is an optional peer for core-only consumers", () => {
  assert.equal(packageManifest.peerDependencies["markdown-it"], ">=12.0.0");
  assert.equal(packageManifest.peerDependenciesMeta["markdown-it"].optional, true);
});

for (const fixture of htmlRenderFixtureCorpus.cases) {
  test(`shared fixture ${fixture.id}: ${fixture.name}`, { skip: fixture.hostSkip?.join(", ") }, () => {
    assertRenderFixture(renderInlineAnnotationsToHtml(fixture.input, fixture.options), fixture);
    assertRenderFixture(inline(fixture.input, fixture.options), fixture);
  });
}

test("basic bracketed under ruby", () => {
  const html = inline("[base]^_(ann)");
  hasAll(html, ['<ruby class="ia-ruby ia-ruby-under"', 'style="ruby-position:under"', "<rt>ann</rt>"]);
});

test("multiple annotations in one paragraph", () => {
  const html = inline("[東]^^(ひがし)[京]^^(きょう)");
  hasAll(html, ["<rt>ひがし</rt>", "<rt>きょう</rt>"]);
  assert.equal((html.match(/<ruby/g) || []).length, 2);
});

test("bouten over", () => {
  const html = inline("[漢字]^^(..)");
  hasAll(html, ['<span class="ia-bouten ia-bouten-over"', "text-emphasis:filled dot", "漢字"]);
});

test("underline variants", () => {
  hasAll(inline("[base]^_(.-)"), ['<span class="ia-underline"', "text-decoration-line:underline"]);
  hasAll(inline("[base]^_(.~)"), ["ia-underline-wavy", "text-decoration-style:wavy"]);
  hasAll(inline("[base]^_(.=)"), ["ia-underline-double", "text-decoration-style:double"]);
});

test("bouten plus wavy underline through chaining", () => {
  const html = inline("[強調]^^(..)^_(.~)");
  hasAll(html, ["ia-bouten-over", "ia-underline-wavy", "text-decoration-style:wavy"]);
});

test("over-slot line mark is an overline", () => {
  const html = inline("[base]^^(.-)");
  hasAll(html, ['<span class="ia-overline"', "text-decoration-line:overline"]);
  hasNone(html, ["<ruby", "ia-underline"]);
});

test("overline variants", () => {
  hasAll(inline("[base]^^(.~)"), ["ia-overline-wavy", "text-decoration-style:wavy"]);
  hasAll(inline("[base]^^(.=)"), ["ia-overline-double", "text-decoration-style:double"]);
});

test("overline above plus underline below", () => {
  const html = inline("[base]^^(.-)^_(.~)");
  hasAll(html, [
    '<span class="ia-overline"',
    '<span class="ia-underline ia-underline-wavy"',
    "text-decoration-line:overline",
    "text-decoration-line:underline",
    "text-decoration-style:wavy",
  ]);
  hasNone(html, ["<ruby"]);
});

test("independent overline and underline styles use separate wrappers", () => {
  const html = inline("[漢字]^^(.-)^_(.~)");
  assert.match(
    html,
    /<span class="ia-overline" style="text-decoration-line:overline"><span class="ia-underline ia-underline-wavy" style="text-decoration-line:underline;text-underline-offset:0\.15em;text-decoration-style:wavy">漢字<\/span><\/span>/
  );
});

test("per-character alignment", () => {
  const html = inline("[春夏秋冬]^^(はる なつ あき ふゆ)");
  hasAll(html, ["<rt>はる</rt>", "<rt>なつ</rt>", "<rt>あき</rt>", "<rt>ふゆ</rt>"]);
  assert.equal((html.match(/<ruby/g) || []).length, 4);
});

test("space alignment can be disabled", () => {
  const html = inline("[真值]^^(Truth Value)", { enableSpaceAlignment: false });
  hasAll(html, ["真值", "<rt>Truth Value</rt>"]);
  assert.equal((html.match(/<rt>/g) || []).length, 1);
});

test("space alignment can be set to off", () => {
  const html = inline("[春夏秋冬]^^(はる なつ あき ふゆ)", { spaceAlignment: "off" });
  hasAll(html, ["春夏秋冬", "<rt>はる なつ あき ふゆ</rt>"]);
  assert.equal((html.match(/<rt>/g) || []).length, 1);
});

test("auto space alignment keeps plain ASCII glosses grouped", () => {
  const html = inline("[真值]^^(Truth Value)", { spaceAlignment: "auto" });
  hasAll(html, ["真值", "<rt>Truth Value</rt>"]);
  assert.equal((html.match(/<rt>/g) || []).length, 1);
});

test("auto space alignment keeps phonetic readings per character", () => {
  const html = inline("[取り返す]^^(と り かえ す)", { spaceAlignment: "auto" });
  hasAll(html, ["<rt>と</rt>", "り<rp>(</rp><rt></rt>", "<rt>かえ</rt>", "す<rp>(</rp><rt></rt>"]);
  assert.equal((html.match(/<ruby/g) || []).length, 4);
});

test("two-level per-character alignment", () => {
  const html = inline("[李太白]^^(Lǐ Tài Bái|ㄌㄧˇ ㄊㄞˋ ㄅㄞˊ)");
  hasAll(html, ["<rt>Lǐ</rt>", "<rt>Tài</rt>", "<rt>Bái</rt>", "<rt>ㄌㄧˇ</rt>", "<rt>ㄊㄞˋ</rt>", "<rt>ㄅㄞˊ</rt>"]);
  assert.equal((html.match(/ia-ruby-double/g) || []).length, 3);
});

test("auto-hide matching kana", () => {
  const html = inline("[振り仮名]^^(ふ り が な)");
  hasAll(html, ["<rt>ふ</rt>", "り<rp>(</rp><rt></rt>", "<rt>が</rt>", "<rt>な</rt>"]);
});

test("nested bracket span", () => {
  const html = inline("[[護]^^(まも)れ]^_(プロテゴ)");
  hasAll(html, ["<rt>まも</rt>", "<rt>プロテゴ</rt>", "れ"]);
});

test("nested title-style annotations", () => {
  const html = inline("[初音ミク^^(偉大なる|世界一姫様)]^_(Vocaloid)");
  hasAll(html, ["<rt>偉大なる</rt>", "<rt>世界一姫様</rt>", "<rt>Vocaloid</rt>"]);
});

test("nested bracket span does not discard inner annotation during alignment", () => {
  const html = inline("[[護]^^(まも)れ]^_(A B)");
  hasAll(html, ["<rt>まも</rt>", "<rt>A B</rt>", "れ"]);
});

test("pipe-saturated annotation leaves later operator as text", () => {
  const html = inline("[李太白]^^(り たい はく|Lǐ Tài Bái)^_(..)");
  hasAll(html, ["<rt>り</rt>", "<rt>たい</rt>", "<rt>はく</rt>", "<rt>Lǐ</rt>", "<rt>Tài</rt>", "<rt>Bái</rt>"]);
  assert.ok(!html.includes("ia-bouten"));
  assert.ok(html.includes("^_(..)"));
});

test("extra pipe levels stay visible", () => {
  const html = inline("[a]^^(x|y|z)");
  hasAll(html, ["<rt>x</rt>", "<rt>y</rt>", "|z"]);
  assert.equal((html.match(/<rt>/g) || []).length, 2);
});

test("escaped pipe stays literal", () => {
  const html = inline("[A|B]^^(a\\|b)");
  hasAll(html, ["A|B", "<rt>a|b</rt>"]);
  assert.equal((html.match(/<rt>/g) || []).length, 1);
});

test("escaped close paren stays literal", () => {
  const html = inline("[x]^^(a\\)b)");
  hasAll(html, ["<rt>a)b</rt>"]);
});

test("balanced parentheses respect source bounds and newline boundaries", () => {
  const input = "[x]^^((semi-)formal)";
  assert.equal(findInlineAnnotationModel(input, 0, input.length - 1), null);
  assert.equal(findInlineAnnotationModel(input)?.source, input);

  for (const newline of ["\n", "\r", "\r\n"]) {
    for (const escape of ["", "\\"]) {
      const source = `[x]^^((semi-${escape}${newline})formal)`;
      assert.equal(findInlineAnnotationModel(source), null);
      assert.equal(renderInlineAnnotationsToHtml(source), source);
    }
  }
});

test("parenthesis balancing honors backslash parity without a nesting limit", () => {
  const even = String.raw`[x]^^(a\\(b))`;
  assert.equal(findInlineAnnotationModel(even)?.slots[0].raw, String.raw`a\\(b)`);
  hasAll(renderInlineAnnotationsToHtml(even), ["<rt>a\\(b)</rt>"]);

  const odd = String.raw`[x]^^(a\\\(b)tail`;
  assert.equal(findInlineAnnotationModel(odd)?.slots[0].raw, String.raw`a\\\(b`);
  hasAll(renderInlineAnnotationsToHtml(odd), ["<rt>a\\(b</rt>", "</ruby>tail"]);

  const annotation = "(".repeat(256) + "text" + ")".repeat(256);
  const model = findInlineAnnotationModel(`[x]^^(${annotation})`);
  assert.equal(model?.slots[0].raw, annotation);
});

test("language examples from Logseq demo", () => {
  hasAll(inline("H₂O^^(Hydrogen Dioxide)"), ["H₂O", "<rt>Hydrogen Dioxide</rt>"]);
  hasAll(inline("[Москва]^^(Moskva|Moscow)"), ["<rt>Moskva</rt>", "<rt>Moscow</rt>"]);
  hasAll(inline("[café]^^(ka.ˈfe|coffee)"), ["café", "<rt>ka.ˈfe</rt>", "<rt>coffee</rt>"]);
});

test("html is escaped in base and annotation", () => {
  assert.equal(
    renderInlineAnnotationsToHtml("[<script>]^^(<b>bold</b>)"),
    '<ruby class="ia-ruby ia-ruby-over" style="ruby-position:over">&lt;script&gt;<rp>(</rp><rt>&lt;b&gt;bold&lt;/b&gt;</rt><rp>)</rp></ruby>'
  );
});

test("nested double ruby pins inner over-position to avoid inheriting under", () => {
  const html = inline("[[護]^^(まも)れ]^_(プロテゴ)");
  hasAll(html, [
    '<ruby class="ia-ruby ia-ruby-under" style="ruby-position:under">',
    '<ruby class="ia-ruby ia-ruby-over" style="ruby-position:over">',
    "<rt>まも</rt>",
    "<rt>プロテゴ</rt>",
  ]);
});

test("per-character double ruby pins each inner over-position", () => {
  const html = inline("[李太白]^^(Lǐ Tài Bái|ㄌㄧˇ ㄊㄞˋ ㄅㄞˊ)");
  assert.equal((html.match(/ruby-position:over/g) || []).length, 3);
  assert.equal((html.match(/ruby-position:under/g) || []).length, 3);
});

test("code span is left to markdown-it", () => {
  const html = inline("`[a]^^(b)` [c]^^(d)");
  hasAll(html, ["<code>[a]^^(b)</code>", "<rt>d</rt>"]);
});

test("links are left to markdown-it", () => {
  const html = inline("[link](https://example.com) [漢字]^^(かんじ)");
  hasAll(html, ['<a href="https://example.com">link</a>', "<rt>かんじ</rt>"]);
});

for (const [name, source] of [
  ["inline link label", "[[字]^^(gloss)](/dest)"],
  ["reference link label", "[label [字]^^(gloss)][ref]\n\n[ref]: /dest"],
  ["image alt text", "![a [字]^^(*gloss* &amp; 'sound')](/img)"],
  ["nested image alt text", "![first ![[字]^^(gloss)](/inner)](/outer)"],
  ["raw HTML anchor", '<a href="/dest">[字]^^(gloss)</a>'],
  ["raw HTML code", "before <code>[字]^^(gloss)</code> after"],
  ["bare autolink", "www.example.com/path^^(x)"],
  ["autolink with a scheme", "https://example.com/a^^(x)"],
]) {
  test(`preserves markdown-it ${name}`, () => {
    const host = new MarkdownIt({ html: true, linkify: true });
    const extended = new MarkdownIt({ html: true, linkify: true }).use(inlineAnnotationPlugin);
    const input = `${source}\n\n[外]^^(outside)`;
    assert.equal(extended.render(input), host.render(source) + md().render("[外]^^(outside)"));
  });
}

test("preserves host emphasis around abbreviated bases", () => {
  const parser = md();
  const ruby = parser.renderInline("字^^(gloss)");
  assert.equal(parser.renderInline("lead _字^^(gloss)_"), `lead <em>${ruby}</em>`);
  assert.equal(parser.renderInline("lead ~~字^^(gloss)~~"), `lead <s>${ruby}</s>`);
});

test("resumes after a failed run of host punctuation", () => {
  const prefix = "-".repeat(4096);
  const parser = md();
  assert.equal(parser.renderInline(`${prefix} [字]^^(gloss)`),
    `${prefix} ${parser.renderInline("[字]^^(gloss)")}`);
});

test("renders deeply nested bases through the source and model APIs", () => {
  const depth = 4096;
  const source = "[".repeat(depth) + "字" + "]^^(r)".repeat(depth);
  const html = renderInlineAnnotationsToHtml(source);
  assert.equal(html.split("<rt>r</rt>").length - 1, depth);
  assert.equal(html.split("<ruby ").length - 1, depth);
  assert.equal(renderInlineAnnotationModelToHtml(findInlineAnnotationModel(source)), html);
});

test("bounded scans preserve UTF-16 source ranges and pipe/chain equivalence", () => {
  const prefix = "😀 prefix ";
  const bases = ["字", "𠮷野", "e\u0301", "word pair", String.raw`a\[b\]`, "[字]^^(inner)"];
  const slots = ["ruby", "..", ".-", "(a(b)c)", String.raw`a\|b`, String.raw`\.-`];

  for (const base of bases) {
    for (const over of slots) {
      for (const under of slots) {
        const pipe = `[${base}]^^(${over}|${under})`;
        const chain = `[${base}]^^(${over})^_(${under})`;
        const input = `${prefix}${chain} [後]^^(later)`;
        const end = prefix.length + chain.length;
        const [model] = findInlineAnnotationModels(input, prefix.length, end);
        assert.equal(model.start, prefix.length);
        assert.equal(model.end, end);
        assert.equal(model.source, chain);
        assert.equal(model.base.raw, base);
        assert.deepEqual(model.slots.map((slot) => slot.raw), [over, under]);
        for (const range of [model.base, ...model.slots]) {
          assert.equal(input.slice(range.start, range.end), range.raw);
        }
        const [truncated] = findInlineAnnotationModels(input, prefix.length, end - 1);
        assert.equal(truncated.slots.length, 1);
        assert.equal(renderInlineAnnotationModelToHtml(model), renderInlineAnnotationsToHtml(pipe));
      }
    }
  }
});

test("core renderer can continue after non-annotation brackets", () => {
  const html = renderInlineAnnotationsToHtml("[link](url) [漢字]^^(かんじ)");
  hasAll(html, ["[link](url)", "<rt>かんじ</rt>"]);
});

test("emphasis still wraps annotation", () => {
  const html = inline("**[漢字]^^(かんじ)**");
  hasAll(html, ["<strong>", "<rt>かんじ</rt>", "</strong>"]);
});

test("strikethrough still wraps annotation", () => {
  const html = inline("~~[漢字]^^(かんじ)~~");
  hasAll(html, ["<s>", "<rt>かんじ</rt>", "</s>"]);
  hasNone(html, ["~~"]);
});

test("markdown-it escapes before an annotation stay host-owned", () => {
  const html = inline("\\# [漢字]^^(かんじ)");
  hasAll(html, ["# ", "<rt>かんじ</rt>"]);
  hasNone(html, ["\\#"]);
});

test("reserved markers remain available to another inline rule", () => {
  function markerPlugin(markdownIt) {
    markdownIt.inline.ruler.before("text", "inline_annotation_test_marker", (state, silent) => {
      if (!state.src.startsWith("::", state.pos)) return false;
      if (!silent) {
        const token = state.push("html_inline", "", 0);
        token.content = "<kbd>::</kbd>";
      }
      state.pos += 2;
      return true;
    });
  }

  const markdownIt = new MarkdownIt().use(inlineAnnotationPlugin).use(markerPlugin);
  const html = markdownIt.renderInline(":: [漢字]^^(かんじ)");
  hasAll(html, ["<kbd>::</kbd>", "<rt>かんじ</rt>"]);
});

test("custom options", () => {
  const html = inline("[漢字]^^(かんじ)", { classPrefix: "x", fallbackParens: "[]" });
  hasAll(html, ['<ruby class="x-ruby x-ruby-over"', "<rp>[</rp>", "<rp>]</rp>"]);
});

test("findInlineAnnotation returns source range", () => {
  const match = findInlineAnnotation("pre [漢字]^^(かんじ)", 0);
  assert.ok(match);
  assert.equal(match.start, 4);
  assert.equal(match.source, "[漢字]^^(かんじ)");
  assert.equal(match.model.base.raw, "漢字");
  assert.equal(match.model.slots[0].raw, "かんじ");
});

test("findInlineAnnotationModel exposes positioned slots", () => {
  const model = findInlineAnnotationModel("pre [base]^_(under)^^(over)", 0);
  assert.ok(model);
  assert.equal(model.form, "bracketed");
  assert.equal(model.base.raw, "base");
  assert.equal(model.primaryOp, "^_");
  assert.deepEqual(
    model.slots.map((slot) => [slot.position, slot.source, slot.raw]),
    [
      ["under", "primary", "under"],
      ["over", "chain", "over"],
    ]
  );
});

test("findInlineAnnotationModels returns non-overlapping source models", () => {
  const models = findInlineAnnotationModels("a [漢字]^^(かんじ) b [base]^_(.-) c");
  assert.deepEqual(models.map((model) => model.source), ["[漢字]^^(かんじ)", "[base]^_(.-)"]);
  assert.deepEqual(models.map((model) => [model.start, model.end]), [
    [2, 13],
    [16, 28],
  ]);
});

test("findInlineAnnotationModelsBeforeMarkdown stops before host Markdown syntax", () => {
  const models = findInlineAnnotationModelsBeforeMarkdown("[a]^^(x) [link [b]^^(y)](https://example.com)");
  assert.deepEqual(models.map((model) => model.source), ["[a]^^(x)"]);
});

test("model renderer matches inline match HTML", () => {
  const match = findInlineAnnotation("[重要語句]^^(じゅうようごく|.-)");
  assert.ok(match);
  assert.equal(renderInlineAnnotationModelToHtml(match.model), match.html);
});

test("pipe-saturated model leaves chained overflow outside range", () => {
  const source = "[李太白]^^(り たい はく|Lǐ Tài Bái)^_(..)";
  const model = findInlineAnnotationModel(source);
  assert.ok(model);
  assert.equal(model.source, "[李太白]^^(り たい はく|Lǐ Tài Bái)");
  assert.equal(source.slice(model.end), "^_(..)");
  assert.equal(model.slots.length, 2);
});

test("model exposes extra pipe overflow range", () => {
  const model = findInlineAnnotationModel("[a]^^(x|y|z)");
  assert.ok(model);
  assert.deepEqual(model.slots.map((slot) => slot.raw), ["x", "y"]);
  assert.deepEqual(model.overflow.map((range) => range.raw), ["|z"]);
  assert.equal(renderInlineAnnotationModelToHtml(model).includes("|z"), true);
});

test("package subpath exports expose core and fixtures", () => {
  const core = require("markdown-it-inline-annotation/core");
  const corpus = require("markdown-it-inline-annotation/fixtures/html-render.json");
  const models = require("markdown-it-inline-annotation/fixtures/models.json");
  const boundaries = require("markdown-it-inline-annotation/fixtures/segment-boundaries.json");
  assert.equal(typeof core.renderInlineAnnotationsToHtml, "function");
  assert.equal(typeof core.findInlineAnnotationModel, "function");
  assert.equal(typeof core.findInlineAnnotationModels, "function");
  assert.equal(corpus.version, 1);
  assert.ok(corpus.cases.length > 0);
  assert.equal(models.version, 1);
  assert.equal(models.offsetEncoding, "utf-16");
  assert.ok(models.cases.length > 0);
  assert.equal(boundaries.version, 1);
  assert.ok(boundaries.cases.length > 0);
});

test("playground embeds fixture data without executable HTML sentinels", () => {
  const html = readFileSync("examples/playground.html", "utf8");
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.ok(html.includes("\\u003cscript\\u003e"));
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.ok(!html.includes('"[<img src=x>]^^(<script>x</script>)"'));
});

test("recovers valid nested candidates after a long malformed prefix", () => {
  const annotation = "[字]^^(reading)";
  for (const prefix of ["x".repeat(8000) + " ", "[".repeat(4000), "a^^(".repeat(1000)]) {
    const source = prefix + annotation;
    assert.deepEqual(
      findInlineAnnotationModels(source).map(({ start, end, source }) => [start, end, source]),
      [[prefix.length, source.length, annotation]],
    );
  }
});

test("renders names that coincide with JavaScript object properties as ruby text", () => {
  for (const text of ["constructor", "__proto__", "toString"]) {
    assert.match(renderInlineAnnotationsToHtml(`[字]^^(${text})`), new RegExp(`<rt>${text}</rt>`));
  }
});

test("escapes renderer options in the contexts where they are emitted", () => {
  const html = renderInlineAnnotationsToHtml("[字]^^(reading)", {
    classPrefix: 'my"annotation',
    fallbackParens: "<&",
  });
  assert.match(html, /class="my&quot;annotation-ruby my&quot;annotation-ruby-over"/);
  assert.match(html, /<rp>&lt;<\/rp><rt>reading<\/rt><rp>&amp;<\/rp>/);
});

test("aligns literal base text when its nested-looking syntax is disabled", () => {
  const html = renderInlineAnnotationsToHtml("[a^^(x)]^_(A B C D E F)", { enableAbbreviated: false });
  assert.equal(html.split("<rt>").length - 1, 6);
});
