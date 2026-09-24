# ADR-0027: ページは URL の変化で作り直さず、取得結果の入れ替わりはページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0026 (通知は常時 mount の live region に集約する。本 ADR が呼び出し層を取得結果へ広げる)、ADR-0019 (検索条件は URL が持つ)

## Context

`/notes` の検索 (ADR-0019) では、打鍵が止まるたびに一覧が入れ替わる。行の半透明と `aria-busy` は読み上げに出ないので、入れ替わったことと件数はスクリーンリーダーに届かない。WCAG 2.2 の 4.1.3 Status Messages は「5 results returned」を例に、結果の件数を status message として伝えることを求める。

ADR-0026 は通知を `announce()` (常時 mount の live region) に集約したが、呼び出し層として決めたのは mutation の `onMutate` / `onSuccess` だけで、query 由来の結果 (取得した一覧の件数) をどの層が通知するかは決めていなかった。

決めるうえでの制約は次のとおり。

| 制約                                                                                                          | 出どころ                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 条件の確定 (debounce → `useDeferredValue`) と取得の決着 (`isFetching`) はページの中で起きる                   | ADR-0019 のデータの流れ                                                                     |
| 同じ条件に対する通知は 1 回にする。debounce 後に通知した直後の Enter (URL が同じ条件になる) で 2 回読ませない | 重複は通知を埋める                                                                          |
| 取得中に通知すると古い件数を読む。無効化済みキャッシュは表示しながら再取得する                                | TanStack Query の `useSuspenseQuery` はデータがあれば Suspend せず、`isFetching` だけが立つ |
| `aria-busy` 単独では通知にならない                                                                            | ADR-0026 の検討案の表が却下                                                                 |

先行例は次のとおり (2026-09-23 に確認)。

| 先行例                                         | 形                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| WCAG 2.2 Understanding 4.1.3                   | Search ボタンの後に「5 results returned」を status として出す。技術は ARIA22 (`role="status"`)                                |
| GOV.UK accessible-autocomplete `src/status.js` | 常時 mount の `role="status"` を 2 つ交互に使い、結果数の文言を 1400ms の debounce で更新する。フォーカスが無いときは出さない |
| Base UI `Combobox.Status`                      | 「root は mount されたままでなければ一貫して読まれない」。children を更新して件数を伝える                                     |

どれも「読まれる要素を先に置き、内容の変化で通知する」形で、変化の検出と重複除去は部品自身が持つ。この repo では読まれる要素が announcer なので、残るのは「変化をどこで検出し、重複をどこで除くか」だけである。

## Decision

**ページは URL の `q` が変わっても作り直さない (`key={q}` を使わない)。そのページの `useEffect` が、条件 (`deferredQ`) と取得の決着 (`!notesQuery.isFetching`) を契機に `announce()` で件数を通知する。直前に通知した条件は `useRef` が持ち、同じなら出さない。初期表示は通知しない。**

| 規範                                                                                                               | 守らないと何が壊れるか                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| effect の契機は条件 (`deferredQ`) と決着 (`settled`) の 2 つ。件数は `useEffectEvent` で最新値を読む               | 契機を deps から外すと通知が抜ける。件数を deps に入れると mutation の楽観行で余計に走る                                                                                                                       |
| 取得中は通知しない                                                                                                 | 無効化済みキャッシュを表示しながら再取得する間に、古い件数を読み上げる                                                                                                                                         |
| 「最後に通知した条件」は `useRef(q)` で持ち、同じ条件の決着 (背景 refetch、Strict Mode の二重 effect) は捨てる     | 同じ内容を 2 回読ませる。件数だけが変わる経路は mutation の通知が担う (ADR-0026)                                                                                                                               |
| 初期表示 (URL の `q`) は通知しない。`useRef(q)` の初期値が URL の `q` なので、最初の決着は同じ条件として捨てられる | ページを開くたびに件数を読み上げる。結果の入れ替わりではない                                                                                                                                                   |
| ページを `key={q}` で作り直さない。通知の記憶も入力欄も、URL の変化をまたいで同じ要素に残す                        | 作り直すと確定 (Enter) のたびに入力欄が新しい要素になりフォーカスが body へ落ちる (2026-09-23 に実測)。ref も初期化され、debounce が明ける前の Enter と戻るで通知が消える (2026-09-23 のレビューで 3 名が指摘) |

入力欄の組み方は `docs/guides/lists-and-search.md`「検索の入力欄を組む」、文言の書き方は `docs/guides/accessibility.md`「読み上げの通知を書く」、テストでの比べ方は `docs/guides/testing/waiting-and-assertions.md`「状態と通知を検証する」にある。

## Consequences

- ADR-0026 の「呼び出し層」を広げる: mutation の通知は feature 側の `onMutate` / `onSuccess`、取得結果の通知はページの effect。どちらも部品は announce しない
- オフラインで `fetchStatus` が `paused` のときは `isFetching` が false なので古いキャッシュの件数を通知し、再接続後の再取得で件数が変わっても同じ条件なので通知し直さない。表示中の一覧と件数は一致しているので誤通知ではなく、`fetchStatus === "idle"` で見ると通知ゼロになるほうが悪い
- 通知が消える経路は ref の更新を消す mutant (「abc」→「」で 2 件目が出ない) で、取得中の通知は決着の条件を外す mutant で、それぞれ `-components/notes-page.test.tsx` が落ちることを 2026-09-23 に確認した

### 再評価の条件

- Base UI か shadcn が結果数の status 部品を出荷したら、announcer ではなくその部品で件数を出す形に寄せる (ADR-0026 の再評価条件と同じ)
- ページを URL の変化で作り直す設計にするなら、記憶を作り直されない層 (route component) へ持ち上げる

## 検討した選択肢

| 案                                                                                 | 評価                                                                                                                                                                       | 採否     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ページの `useEffect` + `useRef` で通知まで持つ                                     | React Aria の combobox と同じ形。ページが作り直されない前提で記憶が残る                                                                                                    | **採用** |
| ページを `key={q}` で作り直す                                                      | React docs の「全 state のリセット」の形だが、確定のたびに入力欄のフォーカスが消え、テーブルやダイアログの state も捨てる。通知の記憶を wrapper へ持ち上げる必要が生まれる | 却下     |
| ページが `onResultsSettled(q, count)` で報告し、route component が記憶と通知を持つ | ページを `key={q}` で作り直す設計でだけ要る。作り直さないなら props と重複除去が 1 段余計になる                                                                            | 却下     |
| 可視の件数を `role="status"` の要素で置く (WCAG の技術 ARIA22 の形)                | ADR-0026 が項目の `role="status"` を却下している                                                                                                                           | 却下     |
| wrapper が URL の `q` の変化だけで通知する                                         | 打鍵中の入れ替わり (debounce 後) が無音になる。GOV.UK は入力中も通知する                                                                                                   | 却下     |
| 記憶を `useSyncExternalStore` の store に置く                                      | ADR-0026 が却下した理由 (Transition の中の store 更新) と同じ                                                                                                              | 却下     |
| 通知しない (`aria-busy` と半透明だけ)                                              | ADR-0026 の検討案の表が却下                                                                                                                                                | 却下     |

## 出典

- WCAG 2.2 Understanding 4.1.3 Status Messages: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- WCAG 技術 ARIA22 (`role="status"`): <https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22>
- GOV.UK accessible-autocomplete `src/status.js`: <https://github.com/alphagov/accessible-autocomplete/blob/main/src/status.js>
- Base UI Combobox (`Combobox.Status` の JSDoc は同梱の `node_modules/@base-ui/react/combobox/status/ComboboxStatus.d.ts`): <https://base-ui.com/react/components/combobox>
- React docs `useEffectEvent`: <https://react.dev/reference/react/useEffectEvent>
- TanStack Query `useSuspenseQuery` (Suspend の条件は `isPending`): <https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery>
