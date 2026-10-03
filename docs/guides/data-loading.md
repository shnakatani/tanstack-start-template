# ページのデータの読み込み

ページのデータを読み、読み込み中の表示と失敗からの再試行を出すときの手順と、その形にしている理由を持つ。

| 決定                                                                                                                  | ADR      |
| --------------------------------------------------------------------------------------------------------------------- | -------- |
| ユーザー操作による更新は Transition を既定にし、query 由来の楽観表示は mutation の variables で出す                   | ADR-0015 |
| router に既定の pending 表示を置き、Suspense の最後の受け皿にする                                                     | ADR-0029 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む | ADR-0033 |

## how-to

### 読み込み中の表示を出す

| 対象                                    | 組み方                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 欠かせない query                        | loader で取得を待ち、ページは `useSuspenseQuery` で読む。読み込み中は route の `pendingComponent` が出し、無ければ router の `defaultPendingComponent` が受ける (ADR-0033、ADR-0029)                                                                                                                                                           |
| 副次的な query                          | loader で取得を流し、ページの中の `<Suspense>` で読む (ADR-0033)                                                                                                                                                                                                                                                                               |
| pending 表示の閾値と最小表示時間        | 既定では、loader が 1 秒より長くかかったときに pending 表示を出し、出したら 500ms は出し続ける。変えるときは router の `defaultPendingMs` / `defaultPendingMinMs` か、route の `pendingMs` / `pendingMinMs` で設定する ([TanStack Router docs「Data Loading」][] の Showing a pending component と Avoiding Pending Component Flash。1.170.39) |
| `useQuery` の `isPending` / `isLoading` | 見て skeleton を出す分岐を書かない。理由は「`isPending` の分岐で読み込み中を出さない理由」                                                                                                                                                                                                                                                     |

- 支援技術への見せ方は `docs/guides/accessibility.md`「読み込み中の表示を組む」にある

### 読み込みに失敗した画面から再試行する

route の errorComponent (`src/components/screens/route-error.tsx` の `RouteErrorContent`) は、[TanStack Router docs「External Data Loading」][] の Error handling with TanStack Query の例の形に合わせる。

| 対象                    | 組み方                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 再試行のボタン          | `router.invalidate()` だけを呼ぶ。loader の再実行と route の error boundary の reset は Router がまとめて行う ([TanStack Router docs「Data Loading」][] の Handling Errors with `routeOptions.errorComponent`)。`startTransition` を自分で書かず、Router の読み込みは Router に任せる (ADR-0015 の「ナビゲーション、GET」の行) |
| Query の error boundary | errorComponent を表示した時点の effect で `useQueryErrorResetBoundary().reset()` を呼ぶ。理由は「再試行で Query の error boundary を表示時に reset する理由」                                                                                                                                                                  |

## explanation

### `isPending` の分岐で読み込み中を出さない理由

TanStack Query 単体の基本形は、`useQuery` の `isPending` を見て読み込み中を出す ([TanStack Query docs「Queries」][])。Router との統合では、公式は SSR に要るかでフックを分ける。このリポジトリは SSR に要らない副次的なデータも `useSuspenseQuery` で読むので (ADR-0033)、`isPending` の分岐を書く場所が無い。

| 公式の手段                                                             | 公式の案内                                                                                                                                                  | このリポジトリ                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR に要るデータを loader で取得し、`useSuspenseQuery` で読む          | サーバーで取得し、解決したらクライアントへストリーミングする ([TanStack Router docs「TanStack Query Integration」][] の Using useSuspenseQuery vs useQuery) | 欠かせない query をこの形で読む (ADR-0033)                                                                                                                                                                                                                                                                                                                                                  |
| SSR に要らないデータを `useQuery` で読む                               | "does not execute on the server; it will fetch on the client after hydration. Use this for data that is not required for SSR." (同上)                       | 採らない。副次的な query も loader で取得を流して `<Suspense>` の中で読み、サーバーで始めた取得の結果を HTML へストリーミングする (ADR-0033 の検討した選択肢)                                                                                                                                                                                                                               |
| 条件が変わる間、`placeholderData: keepPreviousData` で前のデータを残す | key が変わるたびに新しい query として `pending` に戻るのを避ける ([TanStack Query docs「Paginated / Lagged Queries」][])                                    | 採らない。loader で取得しても、ページは公式が勧める suspense のフックで読む (ADR-0033 の検討した選択肢)。`useSuspenseQuery` に `placeholderData` は無く、前の中身は条件の更新を Transition か `useDeferredValue` に通して保つ ([TanStack Query docs「Suspense」][]、[React docs「Suspense」][] の Caveats。組み方は `docs/guides/lists-and-search.md`「入力欄を URL の編集として持つ理由」) |

### 再試行で Query の error boundary を表示時に reset する理由

`useSuspenseQuery` の失敗は Query のキャッシュに残る。[TanStack Router docs「External Data Loading」][] は、errorComponent を表示した時点の effect で `reset` を呼び、route のコンポーネントを描き直すときに query が取得し直すようにする形を示す。表示した時点で reset するので、再試行せずに route を離れて戻ったときも取得し直す (同じ節)。

| 案                                                                                        | 評価                                                                                                                              | 採否     |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 再試行で route の境界の `reset()` と `router.invalidate()` を両方呼ぶ                     | loader が取得しない `useSuspenseQuery` の失敗から回復しない。Query のキャッシュに失敗が残り、取得し直さずに同じエラーを投げ直す   | 却下     |
| 再試行で `router.invalidate()` だけを呼ぶ                                                 | loader が取得を待つ query の失敗からは回復する。loader が取得しない `useSuspenseQuery` の失敗からは、上の案と同じ理由で回復しない | 却下     |
| 再試行で `router.invalidate()` だけを呼び、表示時に Query の error boundary を reset する | 公式の例の形。loader が取得を待つ場合も取得しない場合も回復する                                                                   | **採用** |

評価は `@tanstack/react-router` 1.170.39 と `@tanstack/react-query` 5.104.0 のブラウザテストで、1 回目だけ失敗する query を読む route を描き、再試行で本文が出るかを見た (2026-10-02)。採用した形の回帰は `src/components/screens/route-error.test.tsx` が見る。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。TanStack Router は 1.170.39 を見た (2026-10-02。「TanStack Query Integration」は 2026-10-04)。TanStack Query は 5.104.0 を見た (2026-10-04)。

[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/guide/data-loading
[TanStack Router docs「TanStack Query Integration」]: https://tanstack.com/router/latest/docs/integrations/query
[TanStack Router docs「External Data Loading」]: https://tanstack.com/router/latest/docs/guide/external-data-loading
[TanStack Query docs「Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/queries
[TanStack Query docs「Paginated / Lagged Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries
[TanStack Query docs「Suspense」]: https://tanstack.com/query/latest/docs/framework/react/guides/suspense
[React docs「Suspense」]: https://react.dev/reference/react/Suspense
