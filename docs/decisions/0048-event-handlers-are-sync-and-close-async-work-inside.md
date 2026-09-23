# ADR-0048: イベントハンドラは同期関数とし、非同期処理は内側へ閉じる

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0004 (`typescript/no-misused-promises` を名指しする基準)、ADR-0014 (mutation を伴う操作の Action)

## Context

`typescript/no-misused-promises` は名指しで足したルールのうち、既存コードの構造に最も踏み込む。鳴るのは `async` 関数をイベントハンドラとして prop へ直接渡している箇所である。

## Decision

**ハンドラは同期関数として宣言し、非同期処理はその内側へ閉じる。** 待たない判断は内側で 1 回だけ表明する。

```tsx
function handleSignOut() {
  void performSignOut();
}
<DropdownMenuItem onClick={handleSignOut}>
```

内側の書き方は、失敗をどこで見せるかで決まる。呼び先が通知まで持つなら `void`、呼び出し側で処理するなら `.catch()` である。

呼び出し側の JSX で `void` する形は採らない。ハンドラが名前を失って JSX へインライン化され、失敗の扱いを誰が持つかが読めなくなる。
受け手の prop 型を `() => void | Promise<void>` にする形も採らない。自作コンポーネント間でしか使えず DOM の prop には適用できないため、境界ごとに書き方が割れる。
`checksVoidReturn.attributes` を off にすると、本当に rejection を落としている箇所も検出できなくなる。

React 公式もこの構造を採っている。React 19 の `TransitionFunction` は非同期処理を受け取るが、`onClick` に渡すハンドラ自体は同期である。
mutation を伴う操作は、その同期ハンドラの内側で `startTransition` に非同期関数を渡す形 (Action) にし、pending は Transition から取る。この判断は ADR-0014 が持つ。
`startTransition` を併用すると pending の源が mutation の `isPending` と二重になるが、pending の源を Transition 側へ一本化することでこれを避ける。

## Consequences

- `async` 関数をイベントハンドラとして prop へ直接渡すと `typescript/no-misused-promises` が鳴る。直し方はこの ADR の形になる

## 出典

- 非同期イベントハンドラの書き方に関するメンテナの回答: https://github.com/typescript-eslint/typescript-eslint/issues/11008
- Transition の目的 (ノンブロッキング更新・`isPending`・optimistic update): https://react.dev/reference/react/useTransition
