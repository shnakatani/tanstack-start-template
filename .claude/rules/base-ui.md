---
paths:
  - "src/**"
---

# Base UI コンポーネント利用ルール

## 数値入力は NumberField を使う

- `type="number"` の入力欄を新設しない。`NumberField` を使う。`type="number"` は NVDA の要素一覧で unlabeled になり、ホイールで値が無言に増減する (ADR-0010)
- テストでは `getByRole("textbox")` で取る。`spinbutton` にはならない
- locator の `fill()` は既存値を置換せず追記になる。要素を全選択してから打つ

## Checkbox: disabled は `aria-disabled` で見る

- テストで `toBeDisabled()` を使わない。`toHaveAttribute("aria-disabled", "true")` で見る
- `disabled` が無視されているわけではない。`Checkbox.Root` は span と隠し `input` を描き (公式 docs「Renders a `<span>` element and a hidden `<input>` beside.」)、native の `disabled` はその input が持つ。ただし input は `aria-hidden="true"` / `tabindex="-1"` なので accessibility tree に出ず、`getByRole("checkbox")` は span を返す (Base UI 1.8.0 で実測、2026-09-20)
- 公式 docs は span + 隠し input の構造までで、どちらが native の `disabled` を持つかは書いていない

## Select: `items` prop 必須

Base UI の `Select.Value` はデフォルトで生の `value` を表示する (Radix UI とは異なる挙動)。`Select.Root` に `items` prop で値 → ラベルのマッピングを渡さないと、トリガーに ID 等の内部値がそのまま表示される。

```tsx
const itemsMap = useMemo(() => Object.fromEntries(list.map((x) => [x.id, x.name])), [list]);

<Select items={itemsMap} value={value} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder="選択してください" />
  </SelectTrigger>
  <SelectContent>
    {list.map((x) => (
      <SelectItem key={x.id} value={x.id}>
        {x.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>;
```

`items` は `Record<string, ReactNode>` または `ReadonlyArray<{ value, label }>` 形式。参照の安定化は消費側 (`useMemo` かモジュール定数) の責務。

## Combobox: popup と ItemGroup は型と render が守る

`ComboboxContent` のアクセシブル名は型では止まらない。base-ui は popup の role を `inputInsidePopup ? "dialog" : "presentation"` で決め (`combobox/popup/ComboboxPopup.js`)、popup 内に `ComboboxInput` を置く構成だけが `role="dialog"` で名前を要る。popup の外に置く構成は `presentation` で、`aria-label` は WAI-ARIA 1.2 §5.2.8.6 の MUST NOT になる。判定は実行時の state なので型で分岐できない。名前の過不足は story の axe が見る (`aria-dialog-name` / `aria-prohibited-attr`)。どちらも popup を開く play が無いと働かない (ADR-0006)。

`ItemGroup` は `render={<ul />}`、その子は `Item render={<li />}` と `ItemSeparator render={<li />}` で組む。既定の `role="list"` の div は子に `role="listitem"` を要求するが、`<li>` は ul/ol/menu の中でしか置けないので HTML が破綻する (ADR-0006)。

`Progress` は `children` を渡さないならアクセシブル名を型で要求する。`ProgressLabel` を置けば base-ui が `aria-labelledby` を張る (ADR-0006)。

## Select: 候補が変わったときの自己リセットに依存しない

「選択中の値が候補から消えた」の検出を `onValueChange` の `null` 通知に頼らない。値の解決は消費側で引き取る (実例: `src/components/parts/form-fields.tsx` の `FormSelectField`)。

通知は次のいずれかで届かない。

- トリガーを一度もフォーカスしていない (項目が mount されない)
- 候補の件数が変わらない (1 件削除 + 1 件追加は同じ 1 回の通知にまとまる)
- 現在値が既に `null`

届いても、マウント時の値がまだ解決できればその値へ戻り `null` は来ない。
頼ると解決できない値がトリガーに残り、前節と同じく内部値がそのまま表示される。

`null` を受けたときと、`options` に無い値を受けたときは、どちらも `console.warn` に現在値と突合元を残して表示を保つ。黙って握りつぶすと Base UI との配線不整合が誰にも見えない。
