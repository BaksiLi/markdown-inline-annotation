import corpus from "../../../fixtures/html-render.json";

export interface HtmlRenderFixtureCount {
  pattern: string;
  count: number;
}

export interface HtmlRenderFixture {
  id: string;
  category: string;
  name: string;
  assertionType: "semantic" | "rendering-policy" | "host-skip";
  input: string;
  options?: {
    spaceAlignment?: "always" | "auto" | "off";
  };
  hostSkip?: string[];
  contains?: string[];
  notContains?: string[];
  counts?: HtmlRenderFixtureCount[];
}

export const htmlRenderFixtures = corpus.cases as HtmlRenderFixture[];
