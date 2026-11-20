import { abbreviatedEnabled, DEFAULT_OPTIONS } from "./options.js";
import { AnnotationScanner, hasInlineAnnotation } from "./parse.js";
import { renderInlineAnnotationModelToHtml } from "./html.js";
import type { InlineAnnotationMatch, InlineAnnotationModel, InlineAnnotationOptions } from "./model.js";

export type {
  AnnotationOp,
  AnnotationPosition,
  InlineAnnotationDecoration,
  InlineAnnotationForm,
  InlineAnnotationMatch,
  InlineAnnotationModel,
  InlineAnnotationOptions,
  InlineAnnotationRange,
  InlineAnnotationSlot,
  InlineAnnotationSlotContent,
  InlineAnnotationSlotSource,
  SpaceAlignmentPolicy,
  UnderlineStyle,
} from "./model.js";
export { hasInlineAnnotation } from "./parse.js";
export { renderInlineAnnotationModelToHtml, renderInlineAnnotationsToHtml } from "./html.js";
export { classifyInlineAnnotationSlot } from "./render.js";
export const inlineAnnotationDefaults = DEFAULT_OPTIONS;

function matchFromModel(model: InlineAnnotationModel, options: InlineAnnotationOptions | undefined): InlineAnnotationMatch {
  return {
    start: model.start,
    end: model.end,
    source: model.source,
    html: renderInlineAnnotationModelToHtml(model, options),
    model,
  };
}

function findInlineAnnotationModelsIn(
  input: string,
  start: number,
  max: number,
  rawOptions: InlineAnnotationOptions | undefined,
  stopBeforeMarkdown: boolean
): InlineAnnotationModel[] {
  const models: InlineAnnotationModel[] = [];
  if (!hasInlineAnnotation(input)) return models;

  const scanner = new AnnotationScanner(input, max, abbreviatedEnabled(rawOptions), stopBeforeMarkdown);
  let pos = start;
  while (pos < max) {
    const model = scanner.find(pos);
    if (!model) break;
    models.push(model);
    pos = model.end;
  }
  return models;
}

export function findInlineAnnotationModel(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationModel | null {
  return hasInlineAnnotation(input)
    ? new AnnotationScanner(input, max, abbreviatedEnabled(rawOptions)).find(start)
    : null;
}

export function findInlineAnnotationModelBeforeMarkdown(
  input: string,
  start = 0,
  max = input.length,
  rawOptions?: InlineAnnotationOptions
): InlineAnnotationModel | null {
  return new AnnotationScanner(input, max, abbreviatedEnabled(rawOptions), true).find(start);
}

export function findInlineAnnotationModels(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationModel[] {
  return findInlineAnnotationModelsIn(input, start, max, rawOptions, false);
}

export function findInlineAnnotationModelsBeforeMarkdown(
  input: string,
  start = 0,
  max = input.length,
  rawOptions?: InlineAnnotationOptions
): InlineAnnotationModel[] {
  return findInlineAnnotationModelsIn(input, start, max, rawOptions, true);
}

export function findInlineAnnotation(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationMatch | null {
  const model = findInlineAnnotationModel(input, start, max, rawOptions);
  return model ? matchFromModel(model, rawOptions) : null;
}

export function findInlineAnnotationBeforeMarkdown(input: string, start = 0, max = input.length, rawOptions?: InlineAnnotationOptions): InlineAnnotationMatch | null {
  const model = findInlineAnnotationModelBeforeMarkdown(input, start, max, rawOptions);
  return model ? matchFromModel(model, rawOptions) : null;
}
