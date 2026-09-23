# ADR-0022: ユーザー操作の完了点とブロック範囲は機能ごとに選び、既定は対象の項目だけを止める

- Status: Accepted
- Date: 2026-09-14
- 関連: ADR-0019 / ADR-0021 (Action 層と Transition。本 ADR はその上で「どこまで待つか」「何を止めるか」を決める)、ADR-0041 (二重発火の検証)

## Context

ADR-0019 は mutation を Action 層の Transition で実行し、pending を Transition から取ると決める。
「操作をいつ完了と見なすか」と「完了までに何を触れなくするか」はその外にある問いである。1 つの画面で採った形 (一覧の再取得が終わるまでダイアログを閉じず、一覧の削除トリガーを全て無効化する) を Decision に書くと、他の機能を足すときに当てる軸が無く、その画面の選択が既定として写される。

### 前提となる仕様

| 出典                                           | 内容                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react.dev `useTransition`                      | Action は `startTransition` に渡した関数で、「action の中で await した非同期呼び出しは Transition に含まれる」。何を待つかは書き手が決める。Transition は他の操作をブロックしない                                                                                                                                                                                                                               |
| react.dev `useOptimistic`                      | 「Optimistically adding to a list」の例は各項目に `pending: true` を持たせ「(Adding...)」を付けて一覧へ即時に足す。「Each optimistic item includes a `pending: true` flag so you can show loading state for individual items」。pending は項目ごとに出る                                                                                                                                                        |
| TanStack Query「Invalidations from Mutations」 | 「`onSuccess` で Promise を返すと、mutation が完了する前にデータが更新される (`isPending` は `onSuccess` が解決するまで true)」。返さない場合の記述は無く、`mutateAsync` は応答時点で解決する                                                                                                                                                                                                                   |
| TanStack Query「Optimistic Updates」           | `variables` で UI 側に仮の項目を描く方式と、`onMutate` でキャッシュを書き換えて失敗時に rollback する方式。表示箇所が 1 つなら前者が短い。「再取得が終わるまで mutation が pending に留まるよう、query invalidation の Promise を return せよ」と指針を持つ。別コンポーネントからは `useMutationState` で読み、「`variables` は配列になる。複数の mutation が同時に走りうるため」、一意なキーには `submittedAt` |
| TanStack Query `useMutationState`              | `MutationCache` の全 mutation を読む hook。`filters` の `mutationKey` / `status` / `predicate` で絞り、`select` の結果を mutation ごとに並べた配列を返す                                                                                                                                                                                                                                                        |
| TkDodo「Mastering Mutations」                  | 「submit で閉じるダイアログや、更新後に一覧へ redirect する処理を早すぎる時点でやると取り消しにくい」。rollback の UX は良くない                                                                                                                                                                                                                                                                                |
| TkDodo「Concurrent Optimistic Updates」        | 同じ対象へ複数の mutation が同時に走ると、先に終わった mutation の再取得が後の楽観表示を巻き戻す。`mutationKey` を付け、`onSettled` で `queryClient.isMutating({ mutationKey }) === 1` のときだけ `invalidateQueries` する                                                                                                                                                                                      |
| React Router「Pending UI」/ Remix `useFetcher` | action 完了後、loader の再検証中は `loading` で `idle` ではない。busy 表示は `state !== "idle"` の間、即時性は Optimistic UI で出す                                                                                                                                                                                                                                                                             |
| NN/g「Response Times: The 3 Important Limits」 | 1 秒を超えると思考の流れが途切れる。10 秒を超えるなら進捗表示と中断手段が要る                                                                                                                                                                                                                                                                                                                                   |

### 再取得の完了まで閉じず全トリガーを止める形の問題 (2026-09-13 のメモ画面)

- 再取得が 1 秒を超える環境では、保存は済んでいるのにダイアログが固まって見える。React の Action は再取得を待つことを要求しておらず、待っているのは `useActionMutation` の `runAction` が `mutateAsync` を await し、`onSuccess` が `invalidateQueries` を await する、この 2 つの選択の合成である
- 削除は対象が 1 件なのに一覧の全トリガーを止める。第一の理由は確認ダイアログの handle を全行で共有しており、閉じた後に別行から開き直すと、先行削除の `onSuccess` が同じ handle を `close()` して後続のダイアログを未確定のまま閉じることにある (91515ee の `src/routes/notes/index.tsx` のコメント)。第二に `useMutation` 1 つで pending を追うため、2 件目を始めると `variables` が移り 1 件目の行の表現が消える。前者は確定時に閉じれば消え、後者は追い方を変えれば済む

## Decision

**ユーザー操作の完了点とブロック範囲は、次の 3 軸で機能ごとに選ぶ。既定は「失敗時に戻せるなら確定操作の直後、戻す先が消えるならサーバー応答」で完了とし、止めるのは対象の項目だけにする。**

| 軸               | 選択肢                                                                                                                                       | 選ぶ基準                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完了点           | (a) 確定操作の直後 (楽観) / (b) サーバー応答 / (c) 再取得完了                                                                                | 失敗時に戻す手間で決める。入力を持つフォームは (b)。1 件の削除や toggle は (a)。(c) は古いデータを一瞬も見せられない画面 (残高や在庫のように、表示値で次の操作の可否が決まる画面) に限り、理由を実装近傍に書く                    |
| 楽観表示の置き場 | query が持つデータ → TanStack 側 (`variables` / `useMutationState`、複数箇所なら `onMutate` + rollback) / React だけの状態 → `useOptimistic` | ADR-0019「楽観表示の使い分け」に、複数の表示箇所では `onMutate` + rollback も選べることを足したもの。`useOptimistic` に query の `data` を渡さない (TanStack/query #9742)                                                         |
| ブロック範囲     | 対象の項目だけ / 画面全体                                                                                                                    | 既定は対象の項目だけ。pending は mutation ごとに追う (1 件ずつなら `mutation.variables`、並行か別コンポーネントなら `mutationKey` + `useMutationState`)。画面全体を止めるのは並行操作が整合を壊すときだけで、理由を実装近傍に書く |

完了点の軸が決めるのは「Transition を終える時点」であり、mutation の pending の長さではない。ダイアログを持つ操作では close の時点がそれに当たり、ダイアログの無い操作 (toggle、インライン編集、一括操作) では Action が return する時点がそれに当たる。
mutation は完了点によらず `onSuccess` で再取得の Promise を返し、再取得完了まで pending を保つ (TanStack「Optimistic Updates」の指針。`onMutate` 方式で並行実行を許すときの例外は後述)。対象の項目の busy と楽観の行は、この pending を `useMutationState` (`mutationKey` + `status: "pending"`) か `mutation.variables` で読んで描く。

TanStack Query「Optimistic Updates」の Via the UI の例は `onSettled` で invalidate するが、本 ADR は `onSuccess` を選ぶ (`onMutate` でキャッシュを書き換える方式で並行実行を許すときだけ、後述の `onSettled` + `isMutating` guard を採る)。失敗時は mutation が error へ移って楽観行が消えるため、`onSettled` だと invalidate のタイミングが成功時と揃わない。完了点 (b) はダイアログを開いたまま失敗を迎えるので、`onSettled` に invalidate を置くと入力中のダイアログと消えかけの楽観行 (幽霊行) が同時に見える瞬間が生まれる。`onSuccess` に置けば失敗時は invalidate 自体が走らず、この重なりが起きない。残るリスクは「サーバーは書けたが応答が届かなかった」場合に、`onSuccess` が発火せず一覧が古いまま残ることである。

完了点ごとの Transition の終え方、並行実行を許すときの `mutationKey` と再取得の guard、テンプレートのメモ画面への当て方は `docs/guides/updates-and-data.md`「完了点ごとに Transition を終える」「メモ画面の実例」にある。

### 検討した選択肢

| 案                                | 評価                                                                                                                                                  | 採否     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 機能ごとに 3 軸で選び、既定を持つ | 軸と既定が文書にあり、機能を足すときに同じ問いを立てられる                                                                                            | **採用** |
| 全機能で (c) 再取得完了まで待つ   | 再取得が遅い環境でダイアログが固まる。React の非ブロッキングの設計と React Router の pending UI の形 (`state !== "idle"` の間 busy を出す) から外れる | 却下     |
| 全機能で (a) 楽観                 | 入力を持つフォームの失敗時に戻す先が無い (TkDodo)。rollback の UX が悪い                                                                              | 却下     |
| 軸を rules だけに書く             | 出典と却下理由が rules に入らない (ADR-0002)。半年後に「なぜ待たないのか」を辿れない                                                                  | 却下     |

## Consequences

- ADR-0019 の Decision 表「query の再取得」「ダイアログの開閉」行と、`docs/guides/updates-and-data.md`「mutation の書き方」の「再取得と close」行は本 ADR の軸に従う
- 再取得を待たずに閉じる代わりに、対象の項目に busy 表現を付け忘れると、古い一覧が pending 表示なしで見える。再取得の完了まで閉じない形はこの経路を「閉じない」ことで塞ぐが、本 ADR は項目の表現で塞ぐ
- 再評価条件: concurrent stores (react/react #35449) が出荷したら、query が持つデータへの `useOptimistic` 適用を再評価する (ADR-0019 と同じ)

## 出典

- `useTransition` リファレンス: https://react.dev/reference/react/useTransition
- `useOptimistic` リファレンス: https://react.dev/reference/react/useOptimistic
- TanStack Query「Invalidations from Mutations」: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- TanStack Query「Optimistic Updates」: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- TanStack Query `useMutationState`: https://tanstack.com/query/latest/docs/framework/react/reference/useMutationState
- TkDodo「Mastering Mutations in React Query」: https://tkdodo.eu/blog/mastering-mutations-in-react-query
- TkDodo「Concurrent Optimistic Updates in React Query」: https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query
- React Router「Pending UI」: https://reactrouter.com/start/framework/pending-ui
- Remix `useFetcher`: https://v2.remix.run/docs/hooks/use-fetcher
- NN/g「Response Times: The 3 Important Limits」: https://www.nngroup.com/articles/response-times-3-important-limits/
- TanStack/query #9742: https://github.com/TanStack/query/issues/9742
