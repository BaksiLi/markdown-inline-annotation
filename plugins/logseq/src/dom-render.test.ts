import { describe, it, expect } from "vitest";
import { rubyToHTML, replaceRubyInElement, buildGeneratedFragment } from "./parser";
import { htmlRenderFixtures } from "./spec-fixtures";
import parserSource from "./parser.ts?raw";

// Reference: what the previous innerHTML-based implementation produced for
// renderer output. Used only as a test oracle.
function parsedReference(html: string): HTMLParagraphElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  const expected = document.createElement("p");
  expected.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  return expected;
}

function renderTextNode(text: string): HTMLParagraphElement {
  const host = document.createElement("p");
  host.append(document.createTextNode(text));
  replaceRubyInElement(host);
  return host;
}

function renderTransparentRuns(runs: string[]): HTMLParagraphElement {
  const host = document.createElement("p");
  for (const run of runs) {
    const span = document.createElement("span");
    span.textContent = run;
    host.append(span);
  }
  replaceRubyInElement(host);
  return host;
}

function expectSameDom(actual: Element, expected: Element): void {
  expect(actual.innerHTML).toBe(expected.innerHTML);
  expect(actual.isEqualNode(expected)).toBe(true);
}

function expectOnlyGeneratedElements(host: Element): void {
  for (const element of Array.from(host.querySelectorAll("*"))) {
    expect(["ruby", "rt", "rp", "span"]).toContain(element.localName);
    for (const attr of Array.from(element.attributes)) {
      expect(["class", "style"]).toContain(attr.name);
    }
  }
}

// Inputs free of `<` / `&`, where text and HTML readings agree.
const equivalenceInputs = [
  ...htmlRenderFixtures.map((fixture) => fixture.input).filter((input) => !/[<&]/.test(input)),
  "漢字^^(かんじ)",
  "[base]^^(over)^_(under)",
  "北京^^(Beijing|PKG)",
  "[真值]^^(Truth Value)",
  "[振り仮名]^^(ふ り が な)",
  "[取り返す]^^(と り かえ す)",
  "[[護]^^(まも)れ]^_(プロテゴ)",
  "重要語句^^(じゅうようごく|.-)",
  "漢字^^(..)^_(..)",
  "漢字^_(.~)",
  "漢字^^(.=)^_(.-)",
  "漢字^^(.-)^_(.~)",
  "漢字^^(かんじ)^_(..)",
  "[a]^^(x|y|z)",
  "[a]^^(x|y)^_(z)",
  '[say "hi"]^^(quote ">" here)',
  "before [a\\]b]^^(c\\|d) after",
];

describe("DOM rendering matches parsed renderer output", () => {
  for (const input of equivalenceInputs) {
    it(`text node: ${input}`, () => {
      expectSameDom(renderTextNode(input), parsedReference(rubyToHTML(input)));
    });
  }

  it("covers inputs that actually render", () => {
    const rendered = equivalenceInputs.filter((input) => rubyToHTML(input) !== input);
    expect(rendered.length).toBeGreaterThan(30);
  });

  it("transparent split runs render as one expression", () => {
    const host = renderTransparentRuns(["[漢", "字]^^(かん", "じ)"]);
    expectSameDom(host, parsedReference(rubyToHTML("[漢字]^^(かんじ)")));
  });
});

describe("DOM rendering treats hostile text as text", () => {
  it("does not create elements from markup beside an expression", () => {
    const source = '<img src=x onerror="alert(1)"> 漢^^(かん)';
    const host = renderTextNode(source);
    expect(host.querySelector("img")).toBeNull();
    expectOnlyGeneratedElements(host);
    expect(host.firstChild?.textContent).toBe('<img src=x onerror="alert(1)"> ');
    expect(host.querySelector("rt")?.textContent).toBe("かん");
  });

  it("keeps markup inside base and annotation literal", () => {
    const host = renderTextNode("[<img src=x onerror=alert(1)>]^^(<script>alert(1)</script>)");
    expect(host.querySelector("img, script")).toBeNull();
    expectOnlyGeneratedElements(host);
    expect(host.querySelector("ruby")?.firstChild?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(host.querySelector("rt")?.textContent).toBe("<script>alert(1)</script>");
  });

  it("does not trust text that imitates generated annotation HTML", () => {
    const lookalikes = [
      '[<span class="ia-ruby" onclick="alert(1)">x</span>]^^(y)',
      '<ruby class="ia-ruby" onmouseover="alert(1)">a</ruby> b^^(c)',
      '<span class="ia-underline" style="background:url(javascript:alert(1))">u</span> [v]^_(.-)',
      '[a]^^(b) </ruby></p><img src=x onerror=alert(1)>',
    ];
    for (const source of lookalikes) {
      const host = renderTextNode(source);
      expectOnlyGeneratedElements(host);
      expect(host.querySelector("[onclick], [onmouseover], img")).toBeNull();
      for (const element of Array.from(host.querySelectorAll("*"))) {
        expect(element.getAttribute("style") ?? "").not.toContain("javascript:");
      }
      expect(host.textContent).toContain(source.includes("javascript:") ? "javascript:" : "");
      expect(host.querySelectorAll("ruby, span")).toHaveLength(1);
    }
  });

  it("keeps entity-looking text literal", () => {
    const host = renderTextNode("&lt;b&gt; &amp; &copy 漢^^(&quot;かん&quot;)");
    expect(host.firstChild?.textContent).toBe("&lt;b&gt; &amp; &copy ");
    expect(host.querySelector("rt")?.textContent).toBe("&quot;かん&quot;");
  });

  it("does not create elements from hostile transparent runs", () => {
    const host = renderTransparentRuns(["<img src=x onerror=alert(1)>[a", "]^^(b)"]);
    expect(host.querySelector("img")).toBeNull();
    expectOnlyGeneratedElements(host);
    expect(host.textContent).toBe("<img src=x onerror=alert(1)>a(b)");
  });

  it("keeps literal HTML and entities as text inside a nested base", () => {
    const host = renderTextNode("[[<b>&lt;</b>]^^(inner)]^_(outer)");
    expect(host.querySelector("b")).toBeNull();
    expectOnlyGeneratedElements(host);
    expect(host.querySelectorAll("ruby")).toHaveLength(2);
    expect(host.textContent).toContain("<b>&lt;</b>");
    expect(Array.from(host.querySelectorAll("rt"), (node) => node.textContent)).toEqual(["inner", "outer"]);
  });

  it("keeps escaped operators and brackets literal in a decorated base", () => {
    for (const [source, literal] of [
      [String.raw`[a\^^(b)]^_(.-)`, "a^^(b)"],
      [String.raw`[\[y\]^^(b)]^_(.-)`, "[y]^^(b)"],
    ]) {
      const host = renderTextNode(source);
      expect(host.querySelector(".ia-underline")?.textContent).toBe(literal);
      expect(host.querySelector("ruby")).toBeNull();
      expectSameDom(host, parsedReference(rubyToHTML(source)));
    }
  });

  it("keeps < and & as abbreviated-base boundaries", () => {
    for (const prefix of ["a<", "a&"]) {
      const host = renderTextNode(`${prefix}漢^^(かん)`);
      expect(host.firstChild?.textContent).toBe(prefix);
      expect(host.querySelector("ruby")?.firstChild?.textContent).toBe("漢");
    }
    // Same split as the public string API.
    expect(rubyToHTML("a<漢^^(かん)").startsWith("a<<ruby")).toBe(true);
    expect(rubyToHTML("a&漢^^(かん)").startsWith("a&<ruby")).toBe(true);
  });
});

describe("private-use characters in source text", () => {
  const pua = ["\uE000", "\uE001", "\uE002", "\uF8FF"];

  it("are not boundaries in the public string API", () => {
    for (const ch of pua) {
      expect(rubyToHTML(`${ch}漢^^(かん)`)).toBe(
        `<ruby class="ia-ruby ia-ruby-over" style="ruby-position:over">${ch}漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby>`
      );
    }
  });

  it("render in the DOM exactly as the string API reads them", () => {
    for (const ch of pua) {
      for (const input of [`${ch}漢^^(かん)`, `[${ch}]^^(${ch})`, `x${ch}<漢^^(${ch}&)`]) {
        const host = renderTextNode(input);
        expect(host.textContent).toBe(input.replace(/\^\^\((.*)\)$/, "($1)").replace(/^\[(.*)\]/, "$1"));
      }
      expectSameDom(renderTextNode(`${ch}漢^^(かん)`), parsedReference(rubyToHTML(`${ch}漢^^(かん)`)));
    }
  });

  it("renders even when the source uses the entire private-use area", () => {
    let all = "";
    for (let code = 0xe000; code <= 0xf8ff; code++) all += String.fromCharCode(code);
    const host = renderTextNode(`${all} 漢^^(かん)`);
    expect(host.firstChild?.textContent).toBe(`${all} `);
    expect(host.querySelector("rt")?.textContent).toBe("かん");
  });
});

describe("generated-grammar DOM builder", () => {
  const build = (html: string) => buildGeneratedFragment(html, document);

  it("decodes renderer escapes once", () => {
    expect(build("&lt;b&gt; &amp;amp; &amp;lt; &quot;").textContent).toBe('<b> &amp; &lt; "');
  });

  it("rejects output outside the generated grammar", () => {
    const rejected = [
      "<img src=x>",
      "<script>x</script>",
      '<ruby onclick="x">a</ruby>',
      '<span class="ia-ruby" style="color:red">a</span>',
      '<span class="evil">a</span>',
      '<span class="ia-ruby" class="ia-ruby">a</span>',
      '<rt class="ia-ruby">a</rt>',
      "<ruby>a</span>",
      "<ruby>a",
      "a</ruby>",
      "</ruby class=\"ia-ruby\">",
      "a & b",
      "&copy;",
      "&#60;img&#62;",
      "<RUBY>a</RUBY>",
      "a < b",
    ];
    for (const html of rejected) {
      expect(() => build(html), html).toThrow();
    }
  });
});

describe("production live-render source safety", () => {
  const start = parserSource.indexOf("// DOM live rendering");
  const end = parserSource.indexOf("// Macro renderer helper");
  const liveSection = parserSource.slice(start, end);

  it("isolates the live DOM section", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(liveSection).toContain("export function replaceRubyInElement");
    expect(liveSection).toContain("function buildGeneratedFragment");
  });

  it("uses no HTML assignment or parser sinks in the live path", () => {
    const sinks = [
      /\.innerHTML\b/,
      /\.outerHTML\b/,
      /insertAdjacentHTML/,
      /DOMParser/,
      /createContextualFragment/,
      /document\.write/,
      /setHTMLUnsafe|parseHTMLUnsafe/,
      /\.srcdoc\b/,
      /\beval\s*\(|new Function\s*\(/,
    ];
    for (const sink of sinks) {
      expect(liveSection, String(sink)).not.toMatch(sink);
    }
  });

  it("assigns innerHTML nowhere in parser.ts", () => {
    expect(parserSource).not.toMatch(/\.(?:inner|outer)HTML\s*\+?=(?!=)/);
  });
});
