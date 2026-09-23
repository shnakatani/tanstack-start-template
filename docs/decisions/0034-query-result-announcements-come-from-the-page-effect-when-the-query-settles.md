# ADR-0034: 取得結果の入れ替わりは、ページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0017 (通知は常時 mount の live region に集約する。本 ADR が呼び出し層を取得結果へ広げる)、ADR-0033 (検索条件は URL が持ち、入力欄は URL の q に対する編集として描画中に導く)、ADR-0007 (a11y の床は WCAG 2.2 AA)

## Context

`/notes` の検索 (ADR-0033) では、打鍵が止まるたびに一覧が入れ替わる。行の半透明と `aria-busy` は読み上げに出ないので、入れ替わったことと件数はスクリーンリーダーに届かない。WCAG 2.2 の 4.1.3 Status Messages は「5 results returned」を例に、結果の件数を status message として伝えることを求める。

ADR-0017 は通知を `announce()` (常時 mount の live region) に集約したが、呼び出し層として決めたのは mutation の `onMutate` / `onSuccess` だけで、query 由来の結果 (取得した一覧の件数) をどの層が通知するかは決めていなかった。

決めるうえでの制約は次のとおり。

| 制約                                                                                                          | 出どころ                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 条件の確定 (debounce → `useDeferredValue`) と取得の決着 (`isFetching`) はページの中で起きる                   | ADR-0033 のデータの流れ                                                                     |
| 同じ条件に対する通知は 1 回にする。debounce 後に通知した直後の Enter (URL が同じ条件になる) で 2 回読ませない | 重複は通知を埋める                                                                          |
| 取得中に通知すると古い件数を読む。無効化済みキャッシュは表示しながら再取得する                                | TanStack Query の `useSuspenseQuery` はデータがあれば Suspend せず、`isFetching` だけが立つ |
| `aria-busy` 単独では通知にならない                                                                            | ADR-0017 の検討案の表が却下                                                                 |
| ページは URL の `q` が変わっても作り直されない (`key={q}` を使わない)                                         | ADR-0033。作り直すと確定のたびに入力欄のフォーカスが消える (2026-09-23 に実測)              |

先行例は次のとおり (2026-09-23 に確認)。

| 先行例                                         | 形                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| WCAG 2.2 Understanding 4.1.3                   | Search ボタンの後に「5 results returned」を status として出す。技術は ARIA22 (`role="status"`)                                |
| GOV.UK accessible-autocomplete `src/status.js` | 常時 mount の `role="status"` を 2 つ交互に使い、結果数の文言を 1400ms の debounce で更新する。フォーカスが無いときは出さない |
| Base UI `Combobox.Status`                      | 「root は mount されたままでなければ一貫して読まれない」。children を更新して件数を伝える                                     |

どれも「読まれる要素を先に置き、内容の変化で通知する」形で、変化の検出と重複除去は部品自身が持つ。この repo では読まれる要素が announcer なので、残るのは「変化をどこで検出し、重複をどこで除くか」だけである。

## Decision

**ページの `useEffect` が、条件 (`filter.q`) と取得の決着 (`!notesQuery.isFetching`) を契機に `announce()` で件数を通知する。直前に通知した条件は `useRef` が持ち、同じなら出さない。初期表示は通知しない。**

| 規範                                                                                                                                                                                                            | 守らないと何が壊れるか                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| effect の契機は条件 (`filter.q`) と決着 (`settled`) の 2 つ。件数は `useEffectEvent` で最新値を読む                                                                                                             | 契機を deps から外すと通知が抜ける。件数を deps に入れると mutation の楽観行で余計に走る                                               |
| 取得中は通知しない                                                                                                                                                                                              | 無効化済みキャッシュを表示しながら再取得する間に、古い件数を読み上げる                                                                 |
| 「最後に通知した条件」は `useRef(q)` で持ち、同じ条件の決着 (背景 refetch、Strict Mode の二重 effect) は捨てる                                                                                                  | 同じ内容を 2 回読ませる。件数だけが変わる経路は mutation の通知が担う (ADR-0017)                                                       |
| 初期表示 (URL の `q`) は通知しない。`useRef(q)` の初期値が URL の `q` なので、最初の決着は同じ条件として捨てられる                                                                                              | ページを開くたびに件数を読み上げる。結果の入れ替わりではない                                                                           |
| この形はページが URL の変化をまたいで生き続けることに依存する。`key={q}` でページを作り直す形にしない                                                                                                           | 作り直すと ref が初期化され、debounce が明ける前の Enter と戻るで通知が消える (2026-09-23 のレビューで 3 名が指摘)                     |
| 文言は `noteSearchResultMessage` (`src/routes/notes/-lib/note-search.ts`) が持つ。0 件も件数の形で、条件が空なら解除の文言                                                                                      | 空状態の見出し (『…』に一致するメモはありません) と同じ文字列にすると、テストの `getByText` が live region と見出しの 2 要素に解決する |
| テストは `readAnnouncements()` の配列を丸ごと比べる。ページのテスト (`-components/notes-page.test.tsx`) が debounce 後と無効化済みキャッシュの決着を、wrapper のテスト (`route.test.tsx`) が Enter と戻るを見る | `toContain` だと重複や余計な通知が通る                                                                                                 |

## Consequences

- ADR-0017 の「呼び出し層」を広げる: mutation の通知は feature 側の `onMutate` / `onSuccess`、取得結果の通知はページの effect。どちらも部品は announce しない
- オフラインで `fetchStatus` が `paused` のときは `isFetching` が false なので古いキャッシュの件数を通知し、再接続後の再取得で件数が変わっても同じ条件なので通知し直さない。表示中の一覧と件数は一致しているので誤通知ではなく、`fetchStatus === "idle"` で見ると通知ゼロになるほうが悪い
- 通知が消える経路は ref の更新を消す mutant (「abc」→「」で 2 件目が出ない) で、取得中の通知は決着の条件を外す mutant で、それぞれ `-components/notes-page.test.tsx` が落ちることを 2026-09-23 に確認した
- 2026-09-23 の初版は「ページが `onResultsSettled(q, count)` で報告し、route component が `useRef` で重複を除いて通知する」だった。当時はページを `key={q}` で作り直しており、記憶を URL の変化をまたぐ場所に置く必要があった。作り直しをやめた (ADR-0033) ことで前提が消えたので、同日に本 ADR を書き直した

### 再評価の条件

- Base UI か shadcn が結果数の status 部品を出荷したら、announcer ではなくその部品で件数を出す形に寄せる (ADR-0017 の再評価条件と同じ)
- ページを URL の変化で作り直す設計に戻すなら、記憶を作り直されない層 (route component) へ持ち上げる

## 検討した選択肢

| 案                                                                  | 評価                                                                                           | 採否     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| ページの `useEffect` + `useRef` で通知まで持つ                      | React Aria の combobox と同じ形。ページが作り直されない前提で記憶が残る                        | **採用** |
| ページが報告し、route component が記憶と通知を持つ (初版)           | `key={q}` の作り直しをまたぐために要った。作り直しをやめれば props と重複除去が 1 段余計になる | 却下     |
| 可視の件数を `role="status"` の要素で置く (WCAG の技術 ARIA22 の形) | ADR-0017 が項目の `role="status"` を却下している                                               | 却下     |
| wrapper が URL の `q` の変化だけで通知する                          | 打鍵中の入れ替わり (debounce 後) が無音になる。GOV.UK は入力中も通知する                       | 却下     |
| 記憶を `useSyncExternalStore` の store に置く                       | ADR-0017 が却下した理由 (Transition の中の store 更新) と同じ                                  | 却下     |
| 通知しない (`aria-busy` と半透明だけ)                               | ADR-0017 の検討案の表が却下                                                                    | 却下     |

## 出典

- WCAG 2.2 Understanding 4.1.3 Status Messages: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- WCAG 技術 ARIA22 (`role="status"`): <https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22>
- GOV.UK accessible-autocomplete `src/status.js`: <https://github.com/alphagov/accessible-autocomplete/blob/main/src/status.js>
- Base UI Combobox (`Combobox.Status` の JSDoc は同梱の `node_modules/@base-ui/react/combobox/status/ComboboxStatus.d.ts`): <https://base-ui.com/react/components/combobox>
- React docs `useEffectEvent`: <https://react.dev/reference/react/useEffectEvent>
- TanStack Query `useSuspenseQuery` (Suspend の条件は `isPending`): <https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery>
