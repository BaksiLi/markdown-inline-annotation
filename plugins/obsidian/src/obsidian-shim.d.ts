declare module "obsidian" {
  import type { Extension, StateField } from "@codemirror/state";

  export const editorLivePreviewField: StateField<boolean>;

  export interface MarkdownPostProcessorContext {
    sourcePath: string;
    getSectionInfo(element: HTMLElement): { text: string; lineStart: number; lineEnd: number } | null;
  }

  export class Plugin {
    registerMarkdownPostProcessor(
      postprocessor: (element: HTMLElement, context: MarkdownPostProcessorContext) => void | Promise<void>
    ): void;
    registerEditorExtension(extension: Extension): void;
  }
}
