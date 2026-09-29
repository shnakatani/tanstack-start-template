# ADR-0019: 一覧の絞り込み条件は URL の search param が持ち、loaderDeps で loader に渡す

- Status: Accepted
- Date: 2026-09-29
- 関連: ADR-0013 (ドメイン型は valibot スキーマから導出する)、ADR-0015 (ナビゲーションは Router の Transition に任せる)、ADR-0036 (文字数は code point で数え、入力欄を maxlength で止めない)

## Context

一覧に、文字列の部分一致で絞り込む検索欄を置く。絞り込み条件をどこが持つかが最初の判断で、URL に持てば共有と再読み込みと戻るが効き、Router の loader と Query のキャッシュを条件ごとに分けられる。

制約は次のとおり。

- 一覧のデータは Query が所有し、loader は Query の取得のためだけに呼ぶ (取得を待つかは ADR-0033)。`useLoaderData` で読むと、`invalidateQueries` で Query を更新しても画面が更新されない。TanStack Router の External Data Loading の例も、loader は "ensure that the data is loaded" に使い、コンポーネントは `useSuspenseQuery` で "Read the data from the cache and subscribe to updates" としている。絞り込み条件が変わっても loader の値を `useLoaderData` で読む形にはしない
- Router は search param を loader へ直接渡さない。loader が読む search は `loaderDeps` で宣言し、deps の組み合わせごとに別のキャッシュになる (Router の data-loading ガイド「Using loaderDeps to access search params」)
- Router の search-params ガイドは、malformed な search param には fallback を用意して体験を止めないことを勧め、エラー表示は選んだときだけとする
- URL の値を書き換える契機を打鍵にすると、1 文字ごとに履歴と loader が動く

## Decision

**絞り込み条件は URL の search param `q` が持つ。route が schema で検証し、`loaderDeps` で loader へ渡す。URL への確定は submit (Enter / 検索ボタン) だけが行い、履歴は積まない。**

| 規範                                                                                                                                                                                                                                           | 守らないと何が壊れるか                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL への確定は form の submit だけで、`navigate` は `replace: true` (履歴を積まない)。debounce 後の値を effect で URL へ書かない                                                                                                               | 検索は同じ画面の絞り込みで新しい目的地ではない。push にすると戻るが検索を 1 回ずつ巻き戻す (nuqs は `history` の既定を `replace` にし、push はタブやモーダルのようにナビゲーションに相当するときだけと限定する)。打鍵ごとに書くと履歴と loader が動く |
| `q` の上限は schema が reject せず、code point で切り詰めて末尾の空白を落とす。上限を超えたかは `v.maxCodePoints` が判定し、超えたときだけ `v.fallback` で切る (`src/lib/truncate-code-points.ts`)。入力欄は `maxLength` で止めない (ADR-0036) | search param は malformed でも体験を止めない (Router のガイド)。reject すると、入力欄の経路にだけ別の緩い正規化が要り、厳格と緩和の 2 段になる。trim しないと `" abc"` と `"abc"` が別のキャッシュになる                                              |
| 文字列以外の `q` は schema が日本語の文言で弾く。route の error component に落ちる                                                                                                                                                             | URL の `q` は Router の既定の search パーサが JSON として先に読むので、手で書いた `?q=123` `?q=true` は number / boolean になる。既定の英語文言が UI に出る                                                                                           |

schema を 1 つにする、既定値を URL から落とす、`loaderDeps` で loader に渡す、query key を条件ごとに分ける、の組み方は `docs/guides/lists-and-search.md`「絞り込み条件を URL に置く」にある。

## Consequences

- 検索欄を持つ一覧の route ファイルは、`Route` と、export しない wrapper だけを持つ (ADR-0010)。入力欄と一覧の描画は `docs/guides/lists-and-search.md`「検索の入力欄を組む」にある。テストは `docs/guides/testing/route-wrappers.md`「route の wrapper をテストする」、サーバ側の LIKE は `src/server/db/like-pattern.ts`
- 切り詰めの action は valibot にも主な schema ライブラリにも無い (ADR-0036)。上限の判定は valibot の `maxCodePoints` に任せ、切るのは `truncateCodePoints` だけにする
- `v.fallback` の値は valibot が検証しないので、切った値が同じ判定を通ることは `truncateCodePoints` のテストが確かめる
- 切り詰めは warn しない。入力欄は上限で止めないので、上限を超えて打つのは通常の入力で、warn にすると誤検知になる
- `?q=123` のような文字列以外はその route の境界に落ち、`RouteErrorContent` (見出し「エラーが発生しました」、DEV では Standard Schema の issues の JSON を持つ `error.message`) が描かれる。root の全画面エラーにはならない (2026-09-23 に SSR で実測)。coerce やパーサの差し替えはしない: 他の route の search にも波及し、数値を検索したい利用者が URL を手で書く経路のためだけに既定を外す理由が無い

### 再評価の条件

- TanStack Router が per-param の codec (TanStack/router#4973 の提案) を出荷したら、`?q=123` の扱いを見直す

## 検討した選択肢

| 案                                                    | 評価                                                                                                                                                                              | 採否     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| search param + `loaderDeps`、確定は submit で replace | URL が state なので共有と戻るが効く。Router の公式形 (`loaderDeps`) に乗る                                                                                                        | **採用** |
| 打鍵ごとに URL へ `navigate` する                     | Router の Transition に乗るが、1 文字ごとに loader と履歴が動く。`replace` にしても loader は走る                                                                                 | 却下     |
| submit を push にする                                 | 明示操作 1 回につき履歴 1 つになるが、検索は同じ画面の絞り込みで、戻るが検索を 1 回ずつ巻き戻す。URL state の先行例 (nuqs) は replace を既定にする                                | 却下     |
| debounce 後の値を effect で URL へ書く                | effect で navigate する形になり、確定の主体が曖昧になる。URL の変更は利用者の操作 (submit) に対応させる                                                                           | 却下     |
| 上限超えの `q` を schema で reject する               | URL 経路は error component、入力欄経路は別の緩い正規化が要り、厳格と緩和の 2 段になる。Router のガイドは fallback を勧める                                                        | 却下     |
| 上限超えの `q` を `v.fallback` で既定値 (空) に戻す   | TanStack Router の search-params ガイドが Valibot で示す形 (不正なら既定値)。長すぎる検索語を打つと、確定した時点で絞り込みが外れて全件が出るので、検索が効かなかったように見える | 却下     |
| クライアント側で絞り込む (全件取得して filter)        | 件数が増えると全件取得が重く、URL に条件を持つ意味が薄い。サーバ側の LIKE と `loaderDeps` の実例にもならない                                                                      | 却下     |

## 出典

- TanStack Router の search-params ガイド (Standard Schema、`stripSearchParams`、search middlewares、fallback の推奨): <https://tanstack.com/router/latest/docs/framework/react/guide/search-params>
- TanStack Router の External Data Loading ガイド (loader は Query の取得を待ち、コンポーネントは `useSuspenseQuery` で読む例): <https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading>
- TanStack Router の data-loading ガイド「Using loaderDeps to access search params」: <https://tanstack.com/router/latest/docs/framework/react/guide/data-loading>
- TanStack/router#4973 (Search Params as Actual State。per-param codec の提案): <https://github.com/TanStack/router/issues/4973>
- nuqs `history` option (既定 `replace`。push はナビゲーションに相当するときだけ): <https://nuqs.dev/docs/options>
