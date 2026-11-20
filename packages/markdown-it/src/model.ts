export type AnnotationOp = "^^" | "^_";
export type AnnotationPosition = "over" | "under";
export type SpaceAlignmentPolicy = "always" | "auto" | "off";
export type UnderlineStyle = "solid" | "wavy" | "double";

export interface InlineAnnotationOptions {
  classPrefix?: string;
  enableAbbreviated?: boolean;
  spaceAlignment?: SpaceAlignmentPolicy;
  enableSpaceAlignment?: boolean;
  inlineStyles?: boolean;
  fallbackParens?: string;
}

export type InlineAnnotationForm = "bracketed" | "abbreviated";
export type InlineAnnotationSlotSource = "primary" | "pipe" | "chain";

/** A zero-based, end-exclusive UTF-16 range into the exact original source. */
export interface InlineAnnotationRange {
  start: number;
  end: number;
  /** The original source slice, including any backslash escapes. */
  raw: string;
}

export interface InlineAnnotationSlot extends InlineAnnotationRange {
  position: AnnotationPosition;
  source: InlineAnnotationSlotSource;
}

export type InlineAnnotationDecoration =
  | { kind: "bouten"; position: AnnotationPosition }
  | { kind: "line"; position: AnnotationPosition; style: UnderlineStyle };

export type InlineAnnotationSlotContent = InlineAnnotationDecoration | { kind: "ruby"; raw: string };

export interface InlineAnnotationModel {
  form: InlineAnnotationForm;
  /** Zero-based, end-exclusive UTF-16 offsets into the original source. */
  start: number;
  end: number;
  /** The exact original source slice from start to end. */
  source: string;
  base: InlineAnnotationRange;
  primaryOp: AnnotationOp;
  slots: InlineAnnotationSlot[];
  overflow: InlineAnnotationRange[];
}

export interface InlineAnnotationMatch {
  /** Zero-based, end-exclusive UTF-16 offsets into the original source. */
  start: number;
  end: number;
  html: string;
  /** The exact original source slice from start to end. */
  source: string;
  model: InlineAnnotationModel;
}
