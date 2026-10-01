# ページのデータの読み込み

ページのデータを読み、読み込み中の表示を出すときの手順と、その形にしている理由を持つ。

| 決定                                                                                                                  | ADR      |
| --------------------------------------------------------------------------------------------------------------------- | -------- |
| router に既定の pending 表示を置き、Suspense の最後の受け皿にする                                                     | ADR-0029 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む | ADR-0033 |

## how-to

### 読み込み中の表示を出す

| 対象                                    | 組み方                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 欠かせない query                        | loader で取得を待ち、ページは `useSuspenseQuery` で読む。読み込み中は route の `pendingComponent` が出し、無ければ router の `defaultPendingComponent` が受ける (ADR-0033、ADR-0029)                                                                                                                                            |
| 副次的な query                          | loader で取得を流し、ページの中の `<Suspense>` で読む (ADR-0033)                                                                                                                                                                                                                                                                |
| pending 表示の閾値と最小表示時間        | TanStack Router の既定に任せ、`src/router.tsx` に `defaultPendingMs` / `defaultPendingMinMs` を書かない。既定では、loader が 1 秒より長くかかったときに pending 表示を出し、出したら 500ms は出し続ける ([TanStack Router docs「Data Loading」][] の Showing a pending component と Avoiding Pending Component Flash。1.170.39) |
| `useQuery` の `isPending` / `isLoading` | 見て skeleton を出す分岐を書かない。理由は「`isPending` の分岐で読み込み中を出さない理由」                                                                                                                                                                                                                                      |

- 支援技術への見せ方は `docs/guides/accessibility.md`「読み込み中の表示を組む」にある

## explanation

### `isPending` の分岐で読み込み中を出さない理由

TanStack Query 単体の基本形は、`useQuery` の `isPending` を見て読み込み中を出す ([TanStack Query docs「Queries」][])。ページはこの形を採らず、loader で取得を始めて `useSuspenseQuery` で読む (ADR-0033)。分岐の形は次の 2 点で、読み込み中の表示が要らない場面でも出る。

| 場面               | `useQuery` + `isPending` の分岐                                                                                                                                      | loader + `useSuspenseQuery`                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR                | `useQuery` はサーバーで走らず、hydration の後に client で取得する ([TanStack Router docs「TanStack Query Integration」][])。初めの HTML は読み込み中の表示だけになる | サーバーで取得し、初めの HTML に中身が入る ([TanStack Router docs「TanStack Query Integration」][] の SSR behavior and streaming)             |
| 条件が変わったとき | key が変わると新しい query として `pending` に戻り ([TanStack Query docs「Paginated / Lagged Queries」][])、表示中の中身が読み込み中の表示に置き換わる               | 更新が Transition か `useDeferredValue` によるなら、Suspense は fallback を出さずに表示中の中身を保つ ([React docs「Suspense」][] の Caveats) |

前の値を残す `useQuery` + `placeholderData: keepPreviousData` は、ページに `isPending` の分岐が戻るので採らない (`docs/guides/lists-and-search.md`「入力欄を URL の編集として持つ理由」)。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。TanStack Router は 1.170.39 を見た (2026-10-02)。

[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/guide/data-loading
[TanStack Router docs「TanStack Query Integration」]: https://tanstack.com/router/latest/docs/integrations/query
[TanStack Query docs「Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/queries
[TanStack Query docs「Paginated / Lagged Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries
[React docs「Suspense」]: https://react.dev/reference/react/Suspense
