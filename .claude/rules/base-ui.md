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

## Combobox: popup 内に入力欄を置くなら popup へ名前を与える

`ComboboxContent` の中に `ComboboxInput` を置く構成では、base-ui が popup へ `role="dialog"` を付ける (`combobox/popup/ComboboxPopup.js` の `inputInsidePopup ? 'dialog' : 'presentation'`)。dialog は名前が要るので、`ComboboxContent` に `aria-label` を渡す。

渡さないと axe の `aria-dialog-name` で落ちる。正しい名前は消費側しか知らないため registry 側では既定値を持てない。上流 (shadcn-ui/ui / mui/base-ui) に該当 issue は無い (2026-09-20 に `gh search issues` で確認)。

## ItemGroup の子は `render={<li />}` で listitem にする

`ItemGroup` は `role="list"` を持つが、`Item` は既定で `div` を描き listitem にならない。`Item` は `render` prop を受けるので (`useRender.ComponentProps<"div">`)、`render={<li />}` を渡す。

渡さないと axe の `aria-required-children` で落ちる。`role="listitem"` でも満たせるが、`jsx-a11y/prefer-tag-over-role` の行抑制が要るので採らない。`ItemGroup` 自身は `render` を持たず `ul` にできない (`li` を必須とする content model に違反するため上流が意図して塞いでいる)。

`ItemSeparator` は `ItemGroup` の中に置けない。`role="list"` の子に separator は許されず、`role="presentation"` へ倒しても base-ui が付ける `aria-orientation` が `aria-allowed-attr` で落ちる。区切りが要るなら `ItemGroup` を使わずに並べる。

上流 registry も同じ形で、該当 issue は無い (2026-09-20 に `gh search issues` で確認)。

## Select: 候補が変わったときの自己リセットに依存しない

「選択中の値が候補から消えた」の検出を `onValueChange` の `null` 通知に頼らない。値の解決は消費側で引き取る (実例: `src/components/parts/form-fields.tsx` の `FormSelectField`)。

通知は次のいずれかで届かない。

- トリガーを一度もフォーカスしていない (項目が mount されない)
- 候補の件数が変わらない (1 件削除 + 1 件追加は同じ 1 回の通知にまとまる)
- 現在値が既に `null`

届いても、マウント時の値がまだ解決できればその値へ戻り `null` は来ない。
頼ると解決できない値がトリガーに残り、前節と同じく内部値がそのまま表示される。

`null` を受けたときと、`options` に無い値を受けたときは、どちらも `console.warn` に現在値と突合元を残して表示を保つ。黙って握りつぶすと Base UI との配線不整合が誰にも見えない。
