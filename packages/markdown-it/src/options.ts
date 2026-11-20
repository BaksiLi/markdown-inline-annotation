import type { InlineAnnotationOptions, SpaceAlignmentPolicy } from "./model.js";

export interface ResolvedOptions {
  classPrefix: string;
  enableAbbreviated: boolean;
  spaceAlignment: SpaceAlignmentPolicy;
  inlineStyles: boolean;
  fallbackParens: string;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  classPrefix: "ia",
  enableAbbreviated: true,
  spaceAlignment: "always",
  inlineStyles: true,
  fallbackParens: "()",
};

export function resolveOptions(options?: InlineAnnotationOptions): ResolvedOptions {
  const resolved: ResolvedOptions = {
    classPrefix: options?.classPrefix ?? DEFAULT_OPTIONS.classPrefix,
    enableAbbreviated: abbreviatedEnabled(options),
    spaceAlignment: options?.spaceAlignment ?? DEFAULT_OPTIONS.spaceAlignment,
    inlineStyles: options?.inlineStyles ?? DEFAULT_OPTIONS.inlineStyles,
    fallbackParens: options?.fallbackParens ?? DEFAULT_OPTIONS.fallbackParens,
  };
  if (!options?.spaceAlignment && typeof options?.enableSpaceAlignment === "boolean") {
    resolved.spaceAlignment = options.enableSpaceAlignment ? "always" : "off";
  }
  return resolved;
}

export function abbreviatedEnabled(options?: InlineAnnotationOptions): boolean {
  return options?.enableAbbreviated ?? DEFAULT_OPTIONS.enableAbbreviated;
}
