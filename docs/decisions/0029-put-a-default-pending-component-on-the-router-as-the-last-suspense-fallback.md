# ADR-0029: router に既定の pending 表示を置き、Suspense の最後の受け皿にする

- Status: Accepted
- Date: 2026-09-26
- 関連: ADR-0026 (状態の通知。route の pending 表示の例外)

## Context

route の pending 表示 (`pendingComponent`) は、表示のためだけでなく Suspense の境界として働く。

| 状況                                                            | 起きること                                                                                                           | 出典                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| route に `pendingComponent` も `defaultPendingComponent` も無い | その route には Suspense 境界が張られない。配下の suspend は上位へ巻き上がる                                         | `@tanstack/react-router` 1.170.32 の `Match.tsx` (`ResolvedSuspenseBoundary`)           |
| 巻き上がった先が root の `Outlet`                               | root の `Outlet` は子を `<Suspense fallback={renderPending(router)}>` で包み、既定が無いと fallback は `null` になる | 同 `Match.tsx`、router の issue 2026                                                    |
| `ssr: false` / `data-only` の route                             | サーバーは pending 表示を fallback として描く。どちらも無いと何も描かない                                            | Start の Selective SSR ガイド "If neither is configured, no fallback will be rendered." |

`defaultPendingComponent` には既定値が無い (`RouterOptionsType`)。`defaultErrorComponent` と違い、未設定のときに安全側へ倒れない。

2026-09-26 時点で、テンプレートで `pendingComponent` を持つのは `/notes/` だけである。

## Decision

`src/router.tsx` の `defaultPendingComponent` に `PendingContent` (`src/components/screens/pending.tsx`) を置く。中身は Spinner と「読み込み中」を中央に置いた汎用の表示で、レイアウトを模倣しない。

ページ固有の skeleton は各 route の `pendingComponent` が持つ。route の値が優先される。

ADR-0026 の例外 (状態を `announce()` で通知しない) を `PendingContent` にも当てる。route の pending 表示で、live region の文言として読ませるものではない。

### 検討した選択肢

| 案                                           | 評価                                                                                     | 採否     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| `defaultPendingComponent` に汎用の表示を置く | route が増えても受け皿が漏れない                                                         | **採用** |
| route ごとに `pendingComponent` を足す       | route を足すたびに漏れる。root の `Outlet` の fallback は route を引数に取らず埋まらない | 却下     |
| 既定にレイアウトを模倣する skeleton を置く   | 置かれる位置が route ごとに違い、模倣する対象が定まらない                                | 却下     |
| 何も置かない                                 | 上流の docs が "no fallback will be rendered" と書く状態のまま                           | 却下     |

公式の例 `start-basic-react-query` はこの設定を持たない。一律の推奨ではなく、docs と実装が示す帰結で決めた。

## Consequences

- 全 route が「pending 表示を持つ route」になり、読み込みが `defaultPendingMs` を超えると pending 表示が出る
- route ごとに既定を外す手段は無い (router の issue 7773、PR 8093 が open)
- 既定の表示はレイアウトを模倣しないため、読み込みの完了時にレイアウトがずれる。ずれが問題になるページは、その route に `pendingComponent` を足す
- 既定に `PendingContent` が置かれていることは `src/router.test.ts` が見る。suspend したときに描かれることは `@tanstack/react-router` の `Match.tsx` の実装に拠る

## 出典

- `defaultPendingComponent`: https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType
- Selective SSR の fallback: https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- root の `Outlet` の Suspense: https://github.com/TanStack/router/issues/2026
- route ごとの opt-out: https://github.com/TanStack/router/issues/7773、https://github.com/TanStack/router/pull/8093
