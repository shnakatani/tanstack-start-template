# ADR-0045: root の文書の骨格は root の shellComponent で描く

- Status: Accepted
- Date: 2026-10-30
- 関連: ADR-0026 (常時 mount の live region)、ADR-0029 (router の既定の pending 表示)、ADR-0035 (遷移の後の focus と読み上げ)、ADR-0044 (root は失敗と not found の最後の受け手)

## Context

TanStack Start では、文書の骨格 (`<html>`、`<head>` の `HeadContent`、`<body>`、`Scripts`) を root の route の `component` でも `shellComponent` でも描ける。公式の案内は 2 つの形に分かれる (2026-10-30 に確認。同梱の intent skill は `@tanstack/react-start` 1.168.60 と `@tanstack/start-client-core` 1.170.34 のもの)。

| 置き場所                 | 公式の案内                                                                                                                                                                                                                                                                                        | root の失敗と not found の部品との関係 (`@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchView` の読み)                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root の `component`      | TanStack Start docs「Routing」の「The Root Route」("Its `component` is **always** rendered" / "This is where you render your document shell, e.g. `<html>`, `<body>`, etc.")。例の root は `errorComponent` を持たない。同梱の intent skill (react-start、start-core) も `component` に骨格を描く | root の `errorComponent` と、描画中の `notFound()` を受けた root の `notFoundComponent` は、root の component を置き換えて描かれる                                    |
| root の `shellComponent` | TanStack Start docs「Selective SSR」の「How to disable SSR of the root route?」("The `shellComponent` is always SSRed and is wrapping around the root `component`, the root `errorComponent` or the root `notFound` component respectively.")。上流の example の start-basic もこの形             | shell は root の component・`errorComponent`・`notFoundComponent`・pending の表示を外から包む。root がこのどれを描いていても shell は残る。例外は Consequences に書く |

- `shellComponent` を足した `TanStack/router#4528` (2025-06-27 merge) は本文を持たない。差分は start-basic の `errorComponent` が骨格を描き直していた部分を `shellComponent` に置き換えている
- 骨格を `component` で描くと、root の失敗と not found の間に骨格を残すには、受ける部品ごとに骨格を描き直すことになる

## Decision

**文書の骨格は root の `shellComponent` で描く。root の `component` は置かず、既定の `<Outlet />` を描かせる。root の `errorComponent` と `notFoundComponent` は骨格を描かない。**

| root の option      | 中身                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shellComponent`    | `RootDocument` (`src/routes/__root.tsx`)。`<html>`、`HeadContent`、`<main>` (children、`Toaster`、devtools)、`LiveRegions`、`Scripts`                                    |
| `component`         | 置かない。`MatchInner` は、route にも router の `defaultComponent` にも component が無ければ `<Outlet />` を描く。テンプレートの router は `defaultComponent` を置かない |
| `errorComponent`    | `FullScreenRouteError` を直接置く (ADR-0044)                                                                                                                             |
| `notFoundComponent` | `NotFoundContent` (ADR-0044)                                                                                                                                             |

| 候補                                                                                             | root の失敗の間の骨格                                         | 描画中の `notFound()` を root が受けたときの骨格 | 採否                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component` で描き、`errorComponent` は骨格を描かない (TanStack Start docs「Routing」の例の形)   | 消える (推論)                                                 | 消える (推論)                                    | 却下。root の失敗で `<html>` ごと無くなる                                                                                                                              |
| `component` で描き、`errorComponent` で描き直す (上流の example の start-basic-react-query の形) | 残る。hydration で文書ごと描き直し、`Toaster` は消える (実測) | 消える (実測)                                    | 却下。受ける部品ごとに骨格を描き直すことになり、描き直さない部品で骨格が消える                                                                                         |
| `component` で描き、`errorComponent` と `notFoundComponent` の両方で描き直す                     | 残る (推論)                                                   | 残る (推論)                                      | 却下。どこにも当たらない URL の not found は root の component の `<Outlet />` の位置に描かれるので (ADR-0044)、not found の部品が骨格を描くと `<html>` が入れ子になる |
| `shellComponent` で描く                                                                          | 残る。`Toaster` も残る (実測)                                 | 残る (実測)                                      | 採用                                                                                                                                                                   |

実測は下の「調査結果」にある。推論は `MatchView` の読みと、実測した候補の結果からのものである。

- shell は `children` を描き、`<Outlet />` を描かない。`<Outlet />` を描くと root の `errorComponent` の境界が木に入らない (`TanStack/router#6845` のメンテナの回答 "Shell component is not supposed to render `Outlet`.")
- root の失敗と not found の間も残したいもの (`Toaster`、live region、devtools) を shell に置く。上流の start-basic も devtools を shell に置く

## Consequences

- root の失敗と描画中の `notFound()` で、`<main>`・live region・`Toaster` が残る。root の失敗で live region が作り直されないので、`announce()` が足したノードも消えない
- shell の中で throw すると、root の `errorComponent` では受けられない。shell は root の境界の外にあるので、client では router 全体の外側の境界 (`Matches.tsx` の `MatchesInner`) が受ける (コードの読み。測っていない)。shell には描画で throw しない部品だけを置く
- shell を持つ root は、route の `pendingComponent` か router の `defaultPendingComponent` を fallback にした Suspense で包まれる (`Match.tsx` の `canWrapInSuspense`)。コードを読む限り、root の match が pending になると、前の描画を描き続けずに `PendingContent` (ADR-0029) を shell の中に描く。shell の無い root は Suspense で包まれず、pending の間も前の描画を描き続ける (`MatchInner` のコメント "Replacing an SSR document root with pending UI would remove `<html>`.")
- root の beforeLoad を遅らせたクライアント遷移では、どちらの形でも pending の表示は出なかった。読み込み直しは shell の形で測り、client は root の beforeLoad を走らせなかった。root が pending になる場面は、ほかに測っていない (下の「調査結果」)
- ADR-0029 の前提 (root の `<Outlet />` の Suspense の fallback は router の `defaultPendingComponent` が埋める) は変わらない。`Outlet` の root の分岐は shell の有無を見ない
- router の `InnerWrap` は shell より外にある (`Matches.tsx`)。遷移の読み上げ (ADR-0035) の位置は変わらない
- 本番の root が `RootDocument` を shell に持つことは `src/routes/root-document.test.ts` が見る。shell が root の部品を包むことは router の挙動なので、テンプレートのテストでは見ない

## 調査結果

### dev server (2026-10-30、TanStack Start の dev server、`@tanstack/react-start` 1.168.60、`@tanstack/react-router` 1.170.41、Chrome)

root の beforeLoad の遅延と失敗、root の component の描画中の `notFound()`、ページの loader の失敗は、測るために一時的に足し、測ったあと戻した。

| 場面                                                                  | 骨格を `component` で描き、`errorComponent` で描き直す形                                   | 骨格を `shellComponent` で描く形                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| root の beforeLoad を 4 秒待たせて、`/` からクライアント遷移          | 待つ間は前のページを描き続け、pending の表示は出ない                                       | 同じ                                                                                                          |
| root の beforeLoad を client で遅くして読み込み直す                   | 測っていない                                                                               | client は root の beforeLoad を走らせず、pending にならない                                                   |
| root の component が描画中に `notFound()` を投げる (クライアント遷移) | `<main>` と live region が無くなり、not found の見出しだけが残る                           | `<main>`・live region・`Toaster` が残り、not found の見出しは `<main>` の中に出る。title はページの名前のまま |
| root の beforeLoad の失敗を直接開く (server の HTML)                  | 500、title「エラー: <アプリ名>」、`<h1>` 「エラーが発生しました」(ADR-0044 の「調査結果」) | 同じ。`<main>` と live region を持ち、組み込みの画面の文言は無い                                              |
| 同じ URL の hydration の後                                            | 文書ごと描き直され、`<body>` の子の並びが変わり、`Toaster` が消える                        | server の HTML の並びのまま、`Toaster` が残る                                                                 |
| ページの loader の失敗を直接開く (server の HTML と hydration の後)   | ADR-0044 の「調査結果」の dev server の表                                                  | 同じ status・title・見出し。hydration の後も `<body>` の子の並びは server の HTML のまま                      |

- root の beforeLoad の失敗では、どちらの形でも console に `The above error occurred in the <MatchInnerImpl> component. React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.` と `Warning: Error in route match: __root__/` が出た
- 骨格を `shellComponent` で描く形で、どこにも当たらない URL とページの下の存在しない URL を直接開いた server の HTML は、status・title・見出しが ADR-0044 の「調査結果」の dev server の表と同じだった

## 出典

- TanStack Start docs「Selective SSR」の「How to disable SSR of the root route?」: https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- TanStack Start docs「Routing」の「The Root Route」: https://tanstack.com/start/latest/docs/framework/react/guide/routing
- `TanStack/router#4528` (`shellComponent` を足した PR): https://github.com/TanStack/router/pull/4528
- `TanStack/router#6845` (shell は `<Outlet />` を描かない): https://github.com/TanStack/router/issues/6845
- `TanStack/router#8055` (shell の無い root を Suspense で包まない。"a root with `shellComponent` is safe because the shell owns `<html>/<head>/<body>` and the boundary is placed inside it"): https://github.com/TanStack/router/pull/8055
- 上流の example の start-basic の `__root.tsx`: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/examples/react/start-basic/src/routes/__root.tsx
- 上流の example の start-basic-react-query の `__root.tsx`: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/examples/react/start-basic-react-query/src/routes/__root.tsx
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `canWrapInSuspense`: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L50-L60
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchView` (境界と Suspense を shell の内側に置く): https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L80-L192
- `@tanstack/react-router` 1.170.41 の `Match.tsx` の `MatchInner` の pending の分岐: https://github.com/TanStack/router/blob/57e126e99dbd86f735ead2ba98ba5e98ef0cc668/packages/react-router/src/Match.tsx#L225-L235
