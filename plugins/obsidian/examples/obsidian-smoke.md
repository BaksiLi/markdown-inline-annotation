Use Reading view or Live Preview for this focused smoke file. Source mode
intentionally shows the original source.

## Core

漢字^^(かんじ) renders ruby above.

cat^_(/kæt/) renders ruby below.

北京^^(Beijing|PKG) renders two annotation slots.

[base]^^(over)^_(under) renders chained over/under annotations.

## Study Notes

Frege 把「函數」描述為某種 [不飽和實體]^^(unsaturated entity)：它本身帶有「空位」，需要論元來「補足」才能產生一個完整的值。

[對象]^^(Gegenstand)^_(Object)：任何可以單獨被指稱、作為論元的東西，包括普通個體、數、以及兩個特別的 [真值]^^(Truth Value) The True / The False。

重要語句^^(じゅうようごく|.-) can combine ruby and underline.

漢字^^(.-)^_(.~) keeps a solid overline and wavy underline independent.

漢字^^(.-)^_(.-) keeps line marks on both sides.

In Reading view, check that [不飽和實體]^^(**unsaturated entity**) retains
Obsidian's emphasis if the host splits the expression into separate runs.

## Alignment

Space-based per-character alignment uses conservative auto mode, so multi-word
glosses remain grouped while phonetic readings can align:

[真值]^^(Truth Value)

[取り返す]^^(と り かえ す)

[[護]^^(まも)れ]^_(プロテゴ)

## Known Limits

Host-owned Markdown structures such as inline code, links, wiki links, math,
and complex Markdown inside the base are intentionally left out of this smoke
file. They need syntax-aware editor integration rather than more visual
workarounds.

## Reading and Live Preview

A literal pipe is [term]^^(a\|b) and an escaped line mark is [word]^^(\.-).

A &amp; B &#x1F680; A literal pipe is [term]^^(a\|b) and an escaped line mark is [word]^^(\.-).

&#91;字&#93;^^(literal) and [図書館]^^(としょかん).

The broken [term]^^(x and the next [word]^^(y).

Inline code `[code]^^(reading)` and the [example link](https://example.com) keep their Markdown formatting.

Click [図書館]^^(としょかん) in Live Preview, change the reading, and move the cursor outside the annotation. Switch to Reading view to compare the result.
