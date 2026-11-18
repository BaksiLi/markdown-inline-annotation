---
name: Library/BaksiLi/Inline Annotation
tags: meta/library
files:
  - inline-annotation.js
  - inline-annotation-core.js
  - inline-annotation-LICENSE.txt
  - inline-annotation-demo.md
---

# Inline Annotation for SilverBullet

Write `[漢字]^^(かんじ)` in a Markdown page. Move the cursor into the
annotation to edit the source. Open [[Library/BaksiLi/inline-annotation-demo|Inline Annotation Demo]]
for examples.

```space-lua
local annotation = js.importFromSpace("Library/BaksiLi/inline-annotation.js")

syntax.define {
  name = "InlineAnnotationRuby",
  mode = "inline",
  startMarker = annotation.startMarker,
  endMarker = annotation.endMarker,
  renderClass = "ia-silverbullet-preview",
  renderWidget = function(body)
    return widget.html(annotation.render(body))
  end,
  renderHtml = function(body)
    return annotation.render(body)
  end,
}
```

```space-style
#sb-main .cm-editor .sb-lua-directive-inline.ia-silverbullet-preview {
  border: 0;
  padding: 0;
}

.ia-silverbullet-preview ruby.ia-ruby rt {
  font-size: 0.6em;
  line-height: 1;
}
```
