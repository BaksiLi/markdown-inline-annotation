import { Window } from "happy-dom";

interface DomElementInfo {
  cls?: string | string[];
  text?: string;
}

// Obsidian adds Node.createEl at runtime; mirror the subset the plugin uses.
export function createObsidianWindow(): Window {
  const window = new Window();
  const proto = window.Node.prototype as unknown as Record<string, unknown>;
  if (!proto.createEl) {
    proto.createEl = function (this: Node, tag: string, info: DomElementInfo | string = {}): HTMLElement {
      const options = typeof info === "string" ? { text: info } : info;
      const document = (this.ownerDocument ?? this) as Document;
      const element = document.createElement(tag);
      const classes = typeof options.cls === "string" ? options.cls.split(" ") : options.cls ?? [];
      const names = classes.filter(Boolean);
      if (names.length > 0) element.classList.add(...names);
      if (options.text) element.textContent = options.text;
      this.appendChild(element);
      return element;
    };
  }
  return window;
}
