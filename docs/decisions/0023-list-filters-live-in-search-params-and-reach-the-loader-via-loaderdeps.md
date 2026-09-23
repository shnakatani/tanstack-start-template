# ADR-0023: 一覧の絞り込み条件は URL の search param が持ち、loaderDeps で loader に渡す

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0016 (ドメイン型は valibot スキーマから導出する)、ADR-0018 (ナビゲーションは Router の Transition に任せる)、ADR-0024 (入力欄と一覧の描画)、ADR-0051 (wrapper のテスト)、ADR-0025 (サーバ側の LIKE)

## Context

`/notes` の一覧に title の部分一致で絞り込む検索欄を足す。絞り込み条件をどこが持つかが最初の判断で、URL に持てば共有と再読み込みと戻るが効き、Router の loader と Query のキャッシュを条件ごとに分けられる。

制約は次のとおり。

- 一覧のデータは Query が所有し、loader は Query を温めるだけ (ADR-0013)。絞り込み条件が変わっても loader の値を `useLoaderData` で読む形にはしない
- Router は search param を loader へ直接渡さない。loader が読む search は `loaderDeps` で宣言し、deps の組み合わせごとに別のキャッシュになる (Router の data-loading ガイド「Using loaderDeps to access search params」)
- Router の search-params ガイドは、malformed な search param には fallback を用意して体験を止めないことを勧め、エラー表示は選んだときだけとする
- URL の値を書き換える契機を打鍵にすると、1 文字ごとに履歴と loader が動く

## Decision

**絞り込み条件は URL の search param `q` が持つ。route が schema で検証し、`loaderDeps` で loader へ渡す。URL への確定は submit (Enter / 検索ボタン) だけが行い、履歴は積まない。**

| 規範                                                                                                                                                                                 | 守らないと何が壊れるか                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 絞り込み条件の schema は `src/features/notes/schema.ts` の `noteListFilterSchema` 1 つで、server function の `.validator` と route の `validateSearch` が同じものを使う              | 別々に持つと URL では通るのにサーバで落ちる (またはその逆) 組み合わせが生まれる。valibot 1.x は Standard Schema なので adapter は要らない                                                                                                                                            |
| 既定値は `search.middlewares` の `stripSearchParams(v.getDefaults(noteListFilterSchema))` で URL から落とす。既定は schema から導く                                                  | `/notes` と `/notes?q=` が別の場所になり、履歴と link の比較が揺れる。既定を写すと schema と別々に動く                                                                                                                                                                               |
| loader が読む search は `loaderDeps: ({ search }) => ({ q: search.q })` で宣言し、`loader` は options に直接書いて `notesQueryOptions(deps)` を温める。検証は router 経由 (ADR-0051) | deps に無い search は loader に届かず、preload が別条件のデータを表示側に残す (Router docs の page 2 の例)。loader を関数に切り出すと引数の型を手で書くことになる (`typeof Route` は循環、`LoaderFnContext` は `AnyRoute` 経由で `any`)                                              |
| `notesQueryOptions(filter)` の key は `[...NOTES_QUERY_KEY, filter]`。mutation の invalidate は `NOTES_QUERY_KEY` の前方一致のまま                                                   | 条件ごとに key を分けないと、条件の異なる一覧が同じキャッシュを上書きする。invalidate を条件付き key にすると他の条件の一覧が古いまま残る                                                                                                                                            |
| URL への確定は form の submit だけで、`navigate` は `replace: true` (履歴を積まない)。debounce 後の値を effect で URL へ書かない                                                     | 検索は同じ画面の絞り込みで新しい目的地ではない。push にすると戻るが検索を 1 回ずつ巻き戻す (nuqs は `history` の既定を `replace` にし、push はタブやモーダルのようにナビゲーションに相当するときだけと限定する)。打鍵ごとに書くと履歴と loader が動く                                |
| `q` の上限は schema が reject せず切り詰める (`v.trim()` → `v.transform(truncateCodeUnits)`。`src/lib/truncate-code-units.ts`)。入力欄は `maxLength` を持つ                          | search param は malformed でも体験を止めない (Router のガイド)。reject すると IME の変換中など maxLength が効かない経路 (facebook/react#8683、Chromium 40520211) で入力欄側が別の緩い正規化を要り、厳格と緩和の 2 段になる。trim しないと `" abc"` と `"abc"` が別のキャッシュになる |
| 文字列以外の `q` は schema が日本語の文言で弾く。route の error component に落ちる                                                                                                   | URL の `q` は Router の既定の search パーサが JSON として先に読むので、手で書いた `?q=123` `?q=true` は number / boolean になる。既定の英語文言が UI に出る                                                                                                                          |

## Consequences

- `src/routes/notes/index.tsx` は `Route` と、export しない wrapper だけを持つ (ADR-0013)。入力欄と一覧の描画は ADR-0024、テストは ADR-0051、サーバ側の LIKE は ADR-0025 が持つ
- valibot 1.4.2 に文字列を切り詰める action は無い (`toMaxValue` は辞書順の置換、長さ系は検証のみ。2026-09-23 に同梱の型定義で確認)。切り詰めは `truncateCodeUnits` が持ち、UTF-16 の code unit で数える (`maxLength` と同じ)。切った位置がサロゲートペアの途中なら前半を落とす。落とさないと URL では U+FFFD に化け、`LIKE` にも当たらない (2026-09-23 に better-sqlite3 で実測)
- 切り詰めは warn しない。IME の変換中に上限を超えるのは通常の入力で、warn にすると日本語入力のたびに鳴る誤検知になる
- 手で書いた `/notes?q=<101 文字>` を開くと、URL バーも切り詰め後の 100 文字に書き換わる (Router が `validateSearch` の出力で location を組み直す。2026-09-23 に dev server で実測)
- `?q=123` のような文字列以外は `/notes` の route 境界に落ち、`RouteErrorContent` (見出し「エラーが発生しました」、DEV では Standard Schema の issues の JSON を持つ `error.message`) が描かれる。root の全画面エラーにはならない (2026-09-23 に SSR で実測)。coerce やパーサの差し替えはしない: 他の route の search にも波及し、数値を検索したい利用者が URL を手で書く経路のためだけに既定を外す理由が無い

### 再評価の条件

- TanStack Router が per-param の codec (TanStack/router#4973 の提案) を出荷したら、`?q=123` の扱いを見直す

## 検討した選択肢

| 案                                                    | 評価                                                                                                                                                           | 採否     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| search param + `loaderDeps`、確定は submit で replace | URL が state なので共有と戻るが効く。Router の公式形 (`loaderDeps`) に乗る                                                                                     | **採用** |
| 打鍵ごとに URL へ `navigate` する                     | Router の Transition に乗るが、1 文字ごとに loader と履歴が動く。`replace` にしても loader は走る                                                              | 却下     |
| submit を push にする (2026-09-23 の中間版)           | 明示操作 1 回につき履歴 1 つという理由で採ったが、検索は同じ画面の絞り込みで、戻るが検索を 1 回ずつ巻き戻す。URL state の先行例 (nuqs) は replace を既定にする | 却下     |
| debounce 後の値を effect で URL へ書く                | effect で navigate する形になり、確定の主体が曖昧になる。URL の変更は利用者の操作 (submit) に対応させる                                                        | 却下     |
| 上限超えの `q` を schema で reject する               | URL 経路は error component、入力欄経路は別の緩い正規化が要り、厳格と緩和の 2 段になる。Router のガイドは fallback を勧める                                     | 却下     |
| クライアント側で絞り込む (全件取得して filter)        | 件数が増えると全件取得が重く、URL に条件を持つ意味が薄い。サーバ側の LIKE と `loaderDeps` の実例にもならない                                                   | 却下     |

## 出典

- TanStack Router の search-params ガイド (Standard Schema、`stripSearchParams`、search middlewares、fallback の推奨): <https://tanstack.com/router/latest/docs/framework/react/guide/search-params>
- TanStack Router の data-loading ガイド「Using loaderDeps to access search params」: <https://tanstack.com/router/latest/docs/framework/react/guide/data-loading>
- TanStack/router#4973 (Search Params as Actual State。per-param codec の提案): <https://github.com/TanStack/router/issues/4973>
- nuqs `history` option (既定 `replace`。push はナビゲーションに相当するときだけ): <https://nuqs.dev/docs/options>
- HTML Standard「maxlength」(防止は may): <https://html.spec.whatwg.org/multipage/input.html#attr-input-maxlength>
- facebook/react#8683 (IME の変換中に change が走る) / Chromium 40520211 (変換中に外をクリックすると maxlength を超えたまま確定する): <https://github.com/facebook/react/issues/8683> / <https://issues.chromium.org/issues/40520211>
