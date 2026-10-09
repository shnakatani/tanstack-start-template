# ADR-0041: 既存の値を編集するダイアログは子 route にし、loader が最新の値を取り終えてから開く

- Status: Accepted
- Date: 2026-10-10
- 関連: ADR-0017 (完了点とブロック範囲)、ADR-0026 (状態の通知)、ADR-0033 (loader と Query)、ADR-0035 (遷移の後の focus と title)、ADR-0040 (View Transitions)

## Context

一覧の行から開く編集ダイアログが、一覧のキャッシュの値をフォームの初期値にすると、別のタブや別の利用者が保存した変更より古い値で編集が始まる。

| 事実                                                                                                                                                                                                                                                                                                                                                                          | 出典                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| QueryClient のキャッシュはタブごとにあり、保存後の invalidate はそのタブにしか届かない。タブの間でそろえる `broadcastQueryClient` は "broadcasting and syncing the state of your queryClient between browser tabs/windows" のための utility で、"This utility is currently in an experimental stage." とし、"breaking changes will happen in minor AND patch releases" とある | TanStack Query「broadcastQueryClient (Experimental)」                                                          |
| タブへ戻ったときの再取得は、stale な query にだけ走る ("If a user leaves your application and returns and the query data is stale, ...")                                                                                                                                                                                                                                      | TanStack Query「Window Focus Refetching」                                                                      |
| TanStack Form は、`defaultValues` が変わるとフォームの値を差し替える。利用者が触れたフォーム (`isTouched`) は差し替えない。公式のガイドは、データが届く前に作ったフォームへ、届いた値を `defaultValues` として渡す例を示す                                                                                                                                                    | `@tanstack/form-core` 1.33.5 の `FormApi.update` (`shouldUpdateValues`)、TanStack Form「Async Initial Values」 |
| キャッシュに値があると、`useSuspenseQuery` も `useQuery` もまずその値を返して裏で取り直す。前の値を見せないための `isFetchedAfterMount` がある ("This property can be used to not show any previously cached data.")                                                                                                                                                          | TanStack Query「useQuery」の reference                                                                         |
| loader の既定の `staleReloadMode: 'background'` は、stale な match を前の `loaderData` のまま描いて裏で取り直す ("By default, `staleReloadMode` is `'background'`, so stale successful matches keep rendering with their existing `loaderData` while the loader revalidates in the background.")                                                                              | TanStack Router「Data Loading」                                                                                |

前の値でフォームを開いてから新しい値が届くと、上の TanStack Form の挙動により、触れていないフォームは利用者の目の前で値が替わり、打ち始めたフォームは古い値のまま残る。どちらも、開く前に最新の値を取り終えれば起きない。

## Decision

**既存の値を編集するダイアログは、開く元のページの route の子 route にする。loader は `staleReloadMode: "blocking"` にし、`queryClient.query({ ...options, staleTime: 0 })` を待ってから開く。**

| 対象                      | 決定                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| route                     | 開く元のページを layout route に置き、`<Outlet />` の位置にダイアログの route を描く (TanStack Router の example `location-masking` の形)。URL はマスクしない                                                                                                                                                                                                                                    |
| loader                    | object の形で `staleReloadMode: "blocking"`。キャッシュがあっても取り直し (`staleTime: 0`)、取り終えるまで開かない。`background` では、戻るで入ったときに前に取った値のまま開き、新しい値が届くと、触れていないフォームは値が替わり、打ち始めたフォームは古い値のまま残る                                                                                                                        |
| 1 件の query              | 一覧の query の先頭キーの下に置かない。保存後の一覧の invalidate が前方一致で当たり、閉じかけのダイアログの 1 件まで取り直す。observer の再取得は止める (`staleTime: Infinity`)。開いている間に裏で取り直すと、触れていないフォームは利用者の目の前で値が替わり、触れたフォームには届かない                                                                                                      |
| 開くリンク                | `preload={false}`。開くたびに取り直すので、preload は捨てる取得になる。一覧の search は保つ                                                                                                                                                                                                                                                                                                      |
| 読み込み中                | 押したリンクに `Spinner` (`aria-hidden`) を出す。pending の照合は `useMatchRoute` の `pending` で、route だけで照合して返った params を文字列で比べる。`params.parse` した値を渡すと URL の文字列と比べて一致しない (TanStack/router#2450)                                                                                                                                                       |
| 長い読み込み              | `pendingMs` を超えたら、`pendingComponent` にダイアログの形の読み込み中を出す。開く行のリンクが一覧に無いとき (戻る・進む、URL を直接開いた) も状況が見える                                                                                                                                                                                                                                      |
| 読み込み開始の読み上げ    | 出さない。`pendingMs` の間に本物か読み込み中のダイアログが開き、focus がその中へ移る。ADR-0026 の mutation の開始の通知とは扱いが違う                                                                                                                                                                                                                                                            |
| 行が操作中のリンク        | Link の `disabled` に `tabIndex={0}` を添える。Link は `disabled` で href を外し `role="link"` と `aria-disabled` を付けるので、そのままでは focus できず、閉じたときに focus を戻せない。href を持つ `<a>` に `aria-disabled` を付ける形は採らない (WAI-ARIA 1.2 の `aria-disabled` の Note)                                                                                                    |
| 開閉                      | ダイアログは `open` を state で持つ。閉じる操作では `open` を false にし、閉じるアニメーションの後で一覧へ `navigate` する。先に離れると route ごと unmount して閉じるアニメーションが出ない。読み込み中のダイアログ (`pendingComponent`) だけは閉じる操作の時点で一覧へ戻る。アニメーションを待つ間に取得が終わると、本物のダイアログが替わって開く。一覧へは新しい履歴で戻り、戻るで開き直せる |
| 別の値の URL へ移る       | route に `remountDeps: ({ params }) => params` を付ける。router は既定で、params だけが変わる遷移では component を作り直さない。打ち始めたフォームが前の値のまま残り、保存は移った先の値へ書く                                                                                                                                                                                                   |
| 閉じたときの focus        | 下の表。`finalFocus` に関数を渡して分ける                                                                                                                                                                                                                                                                                                                                                        |
| 見つからない / 取得の失敗 | `notFoundComponent` と `errorComponent` もダイアログの形で出す。例外の文言は出さず固定の文言にする                                                                                                                                                                                                                                                                                               |
| 遷移の伝え方              | ページとの行き来も、ほかの遷移と同じく伝える。開くとダイアログの title、閉じると開く元のページの title を読み上げる。開いたときは focus を背後のページの見出しへ移さず、Base UI がダイアログの中へ移す (ADR-0035)                                                                                                                                                                                |
| View Transition           | 既定のまま (ADR-0040)。戻る・進むで閉じるときは route がすぐ unmount され、閉じるアニメーションが出ない。クロスフェードがその消え方を和らげる                                                                                                                                                                                                                                                    |
| 保存の完了点              | 「サーバー応答」(ADR-0017)。閉じると route は unmount するが、`useMutation` に渡した callback はそのあとも走る (`mutate` に渡す callback は "won't run if your component unmounts before the mutation finishes"。TanStack Query「Mutations」)                                                                                                                                                    |

### 閉じたときの focus

Base UI は `finalFocus` を、閉じたときだけでなく、開いたまま unmount したときにも呼ぶ。戻るでダイアログから一覧へ移ると、route は閉じる操作を経ずに unmount する。

- 開いた行のリンクへ戻さないと、focus はダイアログと一緒に外れ、route の announcer が見出しへ移す (ADR-0035)。利用者は一覧の中の位置を失う
- リンクへ戻した focus は、announcer が動く前に戻り終えるので、見出しへ移らない (2026-10-10 に実測、ADR-0035)

| 閉じ方                                                                       | 開いた行のリンクがある | 開いた行のリンクが無い (URL を直接開いた、絞り込みで外れた)                    |
| ---------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| 利用者が閉じた                                                               | そのリンクへ戻す       | ページの見出しへ、枠を出さずに移す (ADR-0035)                                  |
| 開いたまま unmount した (戻る・進む、読み込み中のダイアログが本物に替わった) | そのリンクへ戻す       | focus に触れない。戻る・進むでは、route の announcer が見出しへ移す (ADR-0035) |

### 検討した選択肢

| 案                                                                                                                                             | 評価                                                                                                                                                                                                         | 採否     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 子 route にし、loader で取ってから開く                                                                                                         | URL で共有でき、戻るで閉じる。loader と Query の連携 (ADR-0033) の形に乗る                                                                                                                                   | **採用** |
| ダイアログは detached trigger のまま、開いてから中で取り直す                                                                                   | キャッシュの値を見せないための `isFetchedAfterMount` の分岐が要る。URL での共有と戻るで閉じる操作は得られない                                                                                                | 却下     |
| キャッシュを即表示し、サーバーとずれた項目を強調する (TkDodo「React Query and Forms」の、触れた項目だけを手元に持ち、他はサーバーの値を出す形) | フォームの部品の作りから変わり、最新の値で始めるという目的に対して大きい                                                                                                                                     | 却下     |
| `broadcastQueryClient` でタブ間のキャッシュをそろえる                                                                                          | experimental。invalidate が同期されるかは docs に無い。別の利用者の変更には届かない                                                                                                                          | 却下     |
| URL を一覧にマスクする                                                                                                                         | 共有するとマスクが外れる ("URLs are automatically unmasked when they are shared")。Start の SSR でハードリロードすると実際の route を失う不具合が open (TanStack/router#7115、`unmaskOnReload: true` の場合) | 却下     |
| 閉じるときに `useCanGoBack` と `router.history.back()` で戻る                                                                                  | "currently _experimental_"。判定は履歴の先頭かどうかだけで、1 つ前が一覧かは分からない。別のページから来ると、閉じてそのページへ戻る                                                                         | 却下     |

## Consequences

- 開いた状態は SSR の HTML に入らない。ダイアログは Base UI のポータルの中にあり、hydration の後に開く。編集のフォームは JS が無いと送信できないので受け入れる (2026-10-09、`@base-ui/react` 1.8.0 で実測)
- 開くたびに 1 件を取得し、取り終えるまで開かない
- 開いた後で別のタブや別の利用者が保存すると、開いた時点の値は古くなる。保存は後から保存した側が先の変更を上書きする。この決定は開く時点の古さだけを防ぐ
- 開く行のリンクが一覧に無いと (戻る・進む、URL を直接開いた)、`pendingMs` までは何も見えない

### 再評価の条件

- TanStack/router#2450 が直り、`matchRoute` が `params.parse` した値で照合するようになったら、pending の照合に `params` を渡す (修正は TanStack/router#7776)

## 実測

2026-10-09 に、`@tanstack/react-router` 1.170.41 (router-core 1.171.34)、`@tanstack/react-query` 5.104.1、`@tanstack/react-form` 1.33.5 (form-core 1.33.5)、`@base-ui/react` 1.8.0、Playwright の Chromium (playwright-cli と、Vitest の browser mode) で測った。Safari と Firefox は測っていない。

| 確かめたこと                                                                                                                                    | 結果                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| hover で preload したあと DB を書き換えて開く                                                                                                   | `blocking` は新しい値で開き、`background` は preload した値で開いた                                                                     |
| `background` で、閉じたあと戻り、取り直しが新しい値を返す (2026-10-10、Vitest の browser mode)                                                  | 前に取った値でフォームが開き、取り直しが決着すると、触れていないフォームは新しい値に替わった                                            |
| `remountDeps` なしで、打ち始めたまま別の id の編集の URL へ `navigate` する (2026-10-10、Vitest の browser mode)                                | フォームは前の id に打った入力のまま残った                                                                                              |
| 読み込み中のダイアログを閉じ、閉じるアニメーションの間に取得を決着させる (2026-10-10、Vitest の browser mode。アニメーションを 60 秒に延ばした) | 閉じるアニメーションの後で戻す形では、本物のダイアログが開き、URL は編集のまま残った                                                    |
| 閉じるアニメーション                                                                                                                            | `onOpenChangeComplete` で `navigate` すると、アニメーションの間は URL が編集のまま                                                      |
| 取得に 2.5 秒かかる場合                                                                                                                         | リンクに `Spinner`、約 1 秒後に読み込み中のダイアログ、取り終えてフォーム。focus は読み込み中のダイアログの「閉じる」から入力欄へ移った |
| 別のページから編集の URL へ `navigate` する (2026-10-10、Vitest の browser mode)                                                                | 背後のページの見出しを経ずに、ダイアログの中の最初の入力欄へ focus が移った                                                             |

## 出典

- TanStack Router example `location-masking`: https://github.com/TanStack/router/tree/main/examples/react/location-masking
- TanStack Router「Data Loading」: https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
- TanStack Router「Route Masking」: https://tanstack.com/router/latest/docs/framework/react/guide/route-masking
- TanStack Router「Navigation」(`useMatchRoute` and `<MatchRoute>`): https://tanstack.com/router/latest/docs/framework/react/guide/navigation
- TanStack Router「RouteOptions type」(`remountDeps`): https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType
- TanStack Router「Static Route Data」: https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data
- TanStack Router「useCanGoBack hook」: https://tanstack.com/router/latest/docs/framework/react/api/router/useCanGoBack
- TanStack Query「Window Focus Refetching」: https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching
- TanStack Query「useQuery」: https://tanstack.com/query/latest/docs/framework/react/reference/useQuery
- TanStack Query「Mutations」: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- TanStack Query「broadcastQueryClient (Experimental)」: https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient
- TanStack Form「Async Initial Values」: https://tanstack.com/form/latest/docs/framework/react/guides/async-initial-values
- `@tanstack/form-core` 1.33.5 の `FormApi.ts`: https://github.com/TanStack/form/blob/@tanstack/form-core@1.33.5/packages/form-core/src/FormApi.ts
- TkDodo「React Query and Forms」: https://tkdodo.eu/blog/react-query-and-forms
- WAI-ARIA 1.2 `aria-disabled`: https://www.w3.org/TR/wai-aria-1.2/#aria-disabled
- TanStack/router#2450: https://github.com/TanStack/router/issues/2450
- TanStack/router#7115: https://github.com/TanStack/router/issues/7115
- TanStack/router#7776: https://github.com/TanStack/router/pull/7776

Router の docs は `@tanstack/react-router@1.170.41`、Query の docs は `@tanstack/react-query@5.104.1`、Form のガイドは `@tanstack/form-core@1.33.5` のタグで確かめた (2026-10-10)。
