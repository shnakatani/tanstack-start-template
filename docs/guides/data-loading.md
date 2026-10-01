# ページのデータの読み込み

ページのデータを読み、読み込み中の表示を出すときの手順を持つ。

| 決定                                                                                                                  | ADR      |
| --------------------------------------------------------------------------------------------------------------------- | -------- |
| router に既定の pending 表示を置き、Suspense の最後の受け皿にする                                                     | ADR-0029 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む | ADR-0033 |

## how-to

### 読み込み中の表示を出す

| 対象                             | 組み方                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 欠かせない query                 | loader で取得を待ち、ページは `useSuspenseQuery` で読む。読み込み中は route の `pendingComponent` が出し、無ければ router の `defaultPendingComponent` が受ける (ADR-0033、ADR-0029)                                                                                                                                            |
| 副次的な query                   | loader で取得を流し、ページの中の `<Suspense>` で読む (ADR-0033)                                                                                                                                                                                                                                                                |
| pending 表示の閾値と最小表示時間 | TanStack Router の既定に任せ、`src/router.tsx` に `defaultPendingMs` / `defaultPendingMinMs` を書かない。既定では、loader が 1 秒より長くかかったときに pending 表示を出し、出したら 500ms は出し続ける ([TanStack Router docs「Data Loading」][] の Showing a pending component と Avoiding Pending Component Flash。1.170.39) |

- 支援技術への見せ方は `docs/guides/accessibility.md`「読み込み中の表示を組む」にある

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。TanStack Router は 1.170.39 を見た (2026-10-02)。

[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/guide/data-loading
