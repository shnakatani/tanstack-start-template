# ページのデータの読み込み

ページのデータを読み、読み込み中の表示を出し、読み込みの失敗を受けて再試行させるときの手順と、その形にしている理由を持つ。

| 決定                                                                                                                  | ADR      |
| --------------------------------------------------------------------------------------------------------------------- | -------- |
| ユーザー操作による更新は Transition を既定にし、query 由来の楽観表示は mutation の variables で出す                   | ADR-0015 |
| router に既定の pending 表示を置き、Suspense の最後の受け皿にする                                                     | ADR-0029 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む | ADR-0033 |
| route の失敗は部品を置いた route が受け、router には既定の失敗の部品を置かない                                        | ADR-0044 |

## how-to

### 読み込み中の表示を出す

| 対象                                                                                                                                | 組み方                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 欠かせない query (ページに入るとき。`enter`・`preload`)                                                                             | loader で取得を待ち、ページは `useSuspenseQuery` で読む。読み込み中は route の `pendingComponent` が出し、無ければ router の `defaultPendingComponent` が受ける (ADR-0033、ADR-0029)                                                                                                                                                           |
| 副次的な query                                                                                                                      | loader で取得を流し、ページの中の `<Suspense>` で読み、`SectionErrorBoundary` で囲む (ADR-0033)                                                                                                                                                                                                                                                |
| 同じ route に留まる読み込み (loader の `cause` が `"stay"`。検索条件・path params の変化、`router.invalidate()`、子 route から戻る) | head の値・notFound・redirect・認可を決めない query は、欠かせない query も待たずに流し、読む部分を `<Suspense>` と `SectionErrorBoundary` で囲む。失敗は区画の中に出て、条件を変えた欄は残る。決める query は stay でも待つ (ADR-0033)                                                                                                        |
| pending 表示の閾値と最小表示時間                                                                                                    | 既定では、loader が 1 秒より長くかかったときに pending 表示を出し、出したら 500ms は出し続ける。変えるときは router の `defaultPendingMs` / `defaultPendingMinMs` か、route の `pendingMs` / `pendingMinMs` で設定する ([TanStack Router docs「Data Loading」][] の Showing a pending component と Avoiding Pending Component Flash。1.170.39) |
| `useQuery` の `isPending` / `isLoading`                                                                                             | 見て skeleton を出す分岐を書かない。理由は「`isPending` の分岐で読み込み中を出さない理由」                                                                                                                                                                                                                                                     |
| skeleton と本体で合わせる値 (表の列見出しと列の幅など)                                                                              | skeleton と本体の両方が参照する定数に置き、片方へ書き写さない。別々に持つと、読み込みが終わって skeleton が本体へ置き換わるときにレイアウトがずれる。表の列見出しの置き方は `docs/guides/lists-and-search.md`「一覧テーブルを組む」にある                                                                                                      |

- 支援技術への見せ方は `docs/guides/accessibility.md`「読み込み中の表示を組む」にある

### 読み込みの失敗を受ける部品を置く

route の読み込みの失敗と描画中の例外は、`errorComponent` を置いた route が受ける。置いていない route の失敗は近い祖先の部品が受け、無ければ root が受ける (ADR-0044)。

| route                                                     | 置く部品                                                                                                                              | 受けたときの画面                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ページの route (`RoutePageHeader` で `<h1>` を描く route) | ページの位置で受けるなら、`errorComponent` に `PageRouteError` (`src/components/screens/route-error.tsx`) を自分で置く                | ページを置き換え、ページ名の `<h1>` の行の下に `<h2>` の失敗の見出しを出す |
| 子を描くレイアウトの route                                | 子の失敗をレイアウトの位置で受けるなら、その route に `errorComponent` を置く                                                         | レイアウトの component を置き換える                                        |
| ページの上に重ねるダイアログの route                      | ダイアログの形の `errorComponent` と `notFoundComponent` (`docs/guides/forms-and-inputs.md`「フォームのダイアログを子 route で組む」) | 開く元のページの上のダイアログ                                             |
| root                                                      | `src/routes/__root.tsx` が `errorComponent` と `notFoundComponent` を持つ。足さない                                                   | 画面全体                                                                   |

- router に `defaultErrorComponent` を置かない。置くと、どの route もその部品で境界を張り、部品を置いた祖先へ失敗が上がらない (ADR-0044)
- router に `defaultNotFoundComponent` を置かない。not found の最後の受け手は root の `notFoundComponent` が担う (ADR-0044)
- `PageRouteError` を `pageRouteOptions` に束ねない。受ける必要の無いページまで受け、祖先へ上がる道が塞がる (ADR-0044)
- `PageRouteError` は `pageName` を持つ route にだけ置く。名前の無い route では見出しの行が throw し、祖先 (無ければ root) のエラーの画面になる
- SSR で描く route が server で失敗し、その route が部品を持たないと、server は祖先へ遡らずにその位置へ組み込みの英語の画面を描き、hydration で client が近い祖先の部品に描き直す。`ssr: false` の配下と、自分の部品を持つ route では起きない (ADR-0044)
- `notFound()` は loader か beforeLoad で投げ、描画中 (component) には投げない。描画中に投げると、部品の置き方によって、どの route にも受けられずアプリ全体が組み込みの英語の画面になるか、root の not found が root の component ごと置き換える (ADR-0044)

### 読み込みに失敗した画面から再試行する

再試行の組み方は、失敗を受ける場所で分かれる。

| 失敗を受ける場所                                                                             | 再試行で呼ぶもの                                                                                                                                     | Query の失敗を戻す時点                                                                                                                                                               | 形の出典                                                                                |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| route の errorComponent                                                                      | `router.invalidate()` だけ。組み方は `src/hooks/use-route-retry.ts` の `useRouteRetry` が持ち、errorComponent はこの hook から再試行のハンドラを取る | errorComponent を表示した時点の effect で `useQueryErrorResetBoundary().reset()` を呼ぶ (`useRouteRetry` の中)。理由は「再試行で Query の error boundary を表示時に reset する理由」 | [TanStack Router docs「External Data Loading」][] の Error handling with TanStack Query |
| ページの中の区画 (`SectionErrorBoundary`、`src/components/parts/section-error-boundary.tsx`) | 境界の `reset()`。子を描き直し、子の `useSuspenseQuery` が取り直す。`router.invalidate()` は呼ばない                                                 | 再試行の click の中で、境界の `reset()` の前に `useQueryErrorResetBoundary().reset()` を呼ぶ。表示した時点では戻さない                                                               | [TanStack Query docs「Suspense」][] の Resetting Error Boundaries                       |

- route の再試行で `startTransition` を自分で書かない。loader の再実行と route の error boundary の reset は Router がまとめて行う ([TanStack Router docs「Data Loading」][] の Handling Errors with `routeOptions.errorComponent`)。Router の読み込みは Router に任せる (ADR-0015 の「ナビゲーション、GET」の行)
- 区画の再試行を `router.invalidate()` に任せない。`CatchBoundary` は `reset()` か `getResetKey` の値の変化でだけ戻るので ([TanStack Router docs「CatchBoundary component」][])、route の読み込みをやり直しても区画のエラーは残る
- 区画の Query の失敗は、子を描き直す直前に戻す。戻してから描き直すまでの間に別の `useSuspenseQuery` が mount すると、戻した状態が取り消され、子は取り直さずに同じ失敗を投げ直す

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

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。TanStack Router は 1.170.39 を見た (2026-10-02。「TanStack Query Integration」は 2026-10-04)。「CatchBoundary component」は 1.170.41 を見た (2026-10-18)。TanStack Query は 5.104.0 を見た (2026-10-04)。

[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/guide/data-loading
[TanStack Router docs「TanStack Query Integration」]: https://tanstack.com/router/latest/docs/integrations/query
[TanStack Router docs「External Data Loading」]: https://tanstack.com/router/latest/docs/guide/external-data-loading
[TanStack Router docs「CatchBoundary component」]: https://tanstack.com/router/latest/docs/framework/react/api/router/catchBoundaryComponent
[TanStack Query docs「Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/queries
[TanStack Query docs「Paginated / Lagged Queries」]: https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries
[TanStack Query docs「Suspense」]: https://tanstack.com/query/latest/docs/framework/react/guides/suspense
[React docs「Suspense」]: https://react.dev/reference/react/Suspense
