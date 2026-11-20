import { decodeHTMLStrict } from "entities";
import type { InlineAnnotationModel } from "markdown-it-inline-annotation/core";

const escapeOrReference = /\\([\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E])|&(?:#[0-9]{1,7}|#[xX][\da-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;

export interface CharacterReference {
  start: number;
  end: number;
}

export function projectMarkdownText(source: string, references?: CharacterReference[]): string {
  return source.replace(escapeOrReference, (matched: string, escaped: string | undefined, start: number) => {
    if (escaped) return escaped;
    const decoded = decodeHTMLStrict(matched);
    if (references && decoded !== matched) references.push({ start, end: start + matched.length });
    return decoded;
  });
}

export function excludeModelsStartingInReferences(
  models: InlineAnnotationModel[],
  references: readonly CharacterReference[],
): InlineAnnotationModel[] {
  if (!references.length) return models;
  let next = 0;
  return models.filter((model) => {
    while (references[next]?.end <= model.start) next++;
    const reference = references[next];
    return !reference || model.start <= reference.start;
  });
}
