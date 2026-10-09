# ADR-0033: ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む

- Status: Accepted
- Date: 2026-10-09
- 関連: ADR-0019 (一覧の絞り込み条件を loader に渡す)、ADR-0029 (既定の pending 表示)、ADR-0041 (既存の値を編集するダイアログの loader)

## Context

ページのデータを route の loader と TanStack Query のどちらから読むか、loader がその取得を待つかで、初めの HTML に何が入るかと、route の遷移がどこで止まるかが決まる。

| 事実                                                                                                                                                                                                               | 出典                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| loader が取得の Promise を返すか await すると、SSR のリクエストはその解決まで止まる。どちらもしなければ、取得はサーバーで始まり、クライアントへストリーミングされる                                                | Router「Query integration」の Prefetching and streaming                  |
| `useSuspenseQuery` は SSR の間にデータが要るときサーバーで走り、解決したらクライアントへストリーミングされる。`useQuery` はサーバーで走らず hydration の後にクライアントで取得するので、SSR に要らないデータに使う | Router「Query integration」の Using useSuspenseQuery vs useQuery         |
| SSR とストリーミングに乗るのは、`useSuspenseQuery` の query と loader で取得した query。素の `useQuery` はサーバーで走らない                                                                                       | Router「Query integration」の SSR behavior and streaming                 |
| loader で取得してフックで読む例は、読むフックに suspense を勧める ("Prefer suspense for best SSR + streaming behavior")                                                                                            | Router「Query integration」の Preload with a loader and read with a hook |
| Query を使うなら、Router の `defer` と `Await` ではなく、loader で取得を始めてライブラリのフックで読む                                                                                                             | Router「Deferred Data Loading」                                          |
| loader で取得を確かめ、コンポーネントはフックでキャッシュを読んで更新を購読する                                                                                                                                    | Router「External Data Loading」                                          |
| 初めの HTML に入れる中身の query は loader で待つ                                                                                                                                                                  | Start「TanStack Query」                                                  |
| ページの主要な中身・タイトル・認可・リダイレクト・存在の有無を決める query は await し、副次的な中身は loader を止めずに流して Suspense の中で描き、SSR の統合の下に置いて結果をブラウザへストリーミングする       | 同ガイドの Await critical data and stream secondary data                 |
| route の `head` が要るタイトルと説明は、loader から返す                                                                                                                                                            | 同上                                                                     |
| SSR の HTML が読み込み中の表示だけになったら、loader が欠かせない query を待ったかと、コンポーネントがその query を読んでいるかを確かめる                                                                          | 同ガイドの Diagnose extra requests の表                                  |
| route の単位では、データが揃うまで描画を止めるか、取得を始めて待たずに描くかを選べる                                                                                                                               | Query「Prefetching」                                                     |
| `useSuspenseQuery` に `placeholderData` は無い。key を変える更新で fallback に置き換わらないようにするには、その更新を `startTransition` に包む                                                                    | Query「Suspense」                                                        |
| 副次的な query は、取得の Promise の reject と、読むコンポーネントの Error Boundary の両方で失敗を受ける                                                                                                           | Start「TanStack Query」の Await critical data and stream secondary data  |
| `prefetchQuery` と `ensureQueryData` は非推奨で、次の major で消える。取得は `queryClient.query` で行う                                                                                                            | Query「Prefetching」                                                     |

Router「Deferred Data Loading」の例は、待たない取得をまだ `prefetchQuery` で書いている (2026-09-28 に確認)。

## Decision

**ページのデータは TanStack Query が持ち、コンポーネントは loader の戻り値ではなく `useSuspenseQuery` で読む。loader は、ページの表示に欠かせない query の取得を待ち、副次的な query は待たずに流す。副次的な query は Suspense の境界の中で読む。**

| 対象                                                                      | 書き方                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 欠かせない query (主要な中身・タイトル・認可・リダイレクト・存在を決める) | loader から `queryClient.query({ ...options, staleTime: "static" })` の Promise を返すか await する。`staleTime: "static"` はキャッシュがあればそれを返し、取得し直しで待たない                                         |
| 副次的な query                                                            | loader で `void queryClient.query(options).catch(noop)` (`noop` は `@tanstack/react-query` の export) とし、読む側を `<Suspense>` と Error Boundary で囲む。reject を受けないと、失敗がサーバーで未処理の reject になる |
| route の `head` が要る値                                                  | loader から返し、`head` で読む。コンポーネントは同じ値も `useSuspenseQuery` で読む                                                                                                                                      |
| 既存の値を編集するダイアログの、フォームの初期値にする query              | loader で `queryClient.query({ ...options, staleTime: 0 })` を `staleReloadMode: "blocking"` で待つ。キャッシュの値で開くと、別のタブや別の利用者の変更より古い値でフォームが始まる (ADR-0041)                          |

欠かせない query かどうかはページごとに、上の表の左列で決める。

### 検討した選択肢

| 案                                                                                       | 評価                                                                                                                                                                                                                                                                                                         | 採否     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 欠かせない query だけを loader で待ち、副次的な query は流す                             | 欠かせない中身が初めの HTML に入り、副次的な取得では遷移も SSR の応答も止まらない。Start のガイドの形                                                                                                                                                                                                        | **採用** |
| すべての query を loader で待つ                                                          | 副次的な取得が遅いと、遷移と SSR の応答がそれを待つ                                                                                                                                                                                                                                                          | 却下     |
| どの query も loader で待たず、ページの中の Suspense で読む                              | loader は止まらないが、欠かせない中身が初めの HTML に入らない                                                                                                                                                                                                                                                | 却下     |
| 副次的な query を loader で流さず、ページで `useQuery` で読む                            | Router「Query integration」が SSR に要らないデータに勧める形。取得は JS の読み込みと hydration を待ってからクライアントで始まり、サーバーでの取得とストリーミングに乗らない                                                                                                                                  | 却下     |
| loader で取得し、ページで `useQuery` (`placeholderData: keepPreviousData` を含む) で読む | loader の取得は SSR とストリーミングに乗る。ただし Router は loader で取得してフックで読む形に suspense を勧め、Start は流した副次的な query を Suspense の境界の中で描く。`keepPreviousData` が担う前の中身の保持は、`useSuspenseQuery` では条件の更新を `startTransition` に包んで得る (Query「Suspense」) | 却下     |
| loader が値を返し、`useLoaderData` と Router の `defer` / `Await` で読む                 | Query を使う場合は使わないと Router のガイドが書く                                                                                                                                                                                                                                                           | 却下     |
| 待たない取得を `prefetchQuery` で書く                                                    | Router「Deferred Data Loading」の例の形だが、Query では非推奨で、次の major で消える                                                                                                                                                                                                                         | 却下     |

## Consequences

- 欠かせない query の取得が遅いと、route の遷移がそれを待つ。その間は route の `pendingComponent` (無ければ ADR-0029 の既定の表示) が出る
- 副次的な query を読む部分は、ページの中で `<Suspense>` に囲む。囲まないと suspend が route の pending 表示まで巻き上がり、ページ全体が置き換わる (ADR-0029 の Context)
- 副次的な query を読む部分は、Error Boundary でも囲む。囲まないと取得の失敗が route の `errorComponent` まで届き、欠かせない中身ごとエラー表示に置き換わる

## 出典

- TanStack Router「Query integration」の SSR behavior and streaming、Using useSuspenseQuery vs useQuery、Preload with a loader and read with a hook、Prefetching and streaming: https://tanstack.com/router/latest/docs/integrations/query
- TanStack Router「Deferred Data Loading」: https://tanstack.com/router/latest/docs/framework/react/guide/deferred-data-loading
- TanStack Router「External Data Loading」: https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading
- TanStack Start「TanStack Query」: https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query
- TanStack Query「Prefetching」: https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
- TanStack Query「Suspense」: https://tanstack.com/query/latest/docs/framework/react/guides/suspense

「Query integration」と Start「TanStack Query」と Query「Suspense」の記述は、`@tanstack/react-router@1.170.39` / `@tanstack/react-start@1.168.58` / `@tanstack/react-query@5.104.0` のタグの docs で確かめた (2026-10-04)。
