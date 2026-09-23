---
paths:
  - "src/**/*.tsx"
---

# Base UI コンポーネント利用ルール

## 数値入力は NumberField を使う

- `type="number"` の入力欄を新設しない。`NumberField` を使う。`type="number"` は NVDA の要素一覧で unlabeled になり、ホイールで値が無言に増減する (ADR-0027)
- テストでは `getByRole("textbox")` で取る。`spinbutton` にはならない (`docs/guides/testing.md`「入力部品を操作する」)
- locator の `fill()` は既存値を置換せず追記になる。要素を全選択してから打つ (`docs/guides/testing.md`「入力部品を操作する」)

## Select: `items` prop 必須

- `Select.Root` に `items` (`Record<string, ReactNode>` か `{ value, label }[]`) を渡す。無いと `Select.Value` がトリガーに ID などの内部値を出す (Base UI Select docs「Formatting the value」)
- 実例は `src/components/parts/form-fields.tsx` の `FormSelectField`

## Select: 候補が変わったときの自己リセットに依存しない

- 現在値が候補から消えたことを `onValueChange` の `null` 通知で検出しない。通知が来ない条件がある。値の解決は消費側で引き取る (ADR-0029)
- `null` や `options` に無い値を受けたら、表示を保ったまま `console.warn` に現在値と突合元を残す (`docs/guides/forms-and-inputs.md`「Select の値を解決する」)

## Combobox と ItemGroup

- `ComboboxContent` の中に `ComboboxInput` を置く構成だけ `aria-label` を渡す。外に置く構成で渡すと name prohibited の違反になる (`docs/registry-deviations.md` の combobox.tsx の行)
- 名前の過不足は story の axe が見る。popup を開く play を書かないと働かない (`docs/registry-deviations.md` の combobox.tsx の行)
- `ItemGroup` は `render={<ul />}`、子は `Item render={<li />}` と `ItemSeparator render={<li />}` で組む。既定の div のままだと list の構造が破綻する (`docs/registry-deviations.md` の item.tsx の行)
