# ADR-0034: 取得結果の入れ替わりはページが決着で報告し、通知と重複除去は URL の変化をまたぐ route component が持つ

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0017 (通知は常時 mount の live region に集約する。本 ADR が呼び出し層を取得結果へ広げる)、ADR-0033 (検索条件は URL が持ち、ページは `key={q}` で作り直す)、ADR-0007 (a11y の床は WCAG 2.2 AA)

## Context

`/notes` の検索 (ADR-0033) では、打鍵が止まるたびに一覧が入れ替わる。行の半透明と `aria-busy` は読み上げに出ないので、入れ替わったことと件数はスクリーンリーダーに届かない。WCAG 2.2 の 4.1.3 Status Messages は「5 results returned」を例に、結果の件数を status message として伝えることを求める。

ADR-0017 は通知を `announce()` (常時 mount の live region) に集約したが、呼び出し層として決めたのは mutation の `onMutate` / `onSuccess` だけで、query 由来の結果 (取得した一覧の件数) をどの層が通知するかは決めていなかった。

決めるうえでの制約は次のとおり。

| 制約                                                                                                        | 出どころ                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 条件の確定 (debounce → `useDeferredValue`) と取得の決着 (`isFetching`) はページの中で起きる                 | ADR-0033 のデータの流れ                                                                     |
| ページは URL の `q` が変わるたびに `key={q}` で作り直され、ページ内の state と ref は消える                 | ADR-0033 (React docs「Resetting all state when a prop changes」)                            |
| 同じ条件に対する通知は 1 回にする。debounce 後に通知した直後の Enter (同じ条件で作り直し) で 2 回読ませない | ADR-0017 の「同じ tick で queue に入った通知は消される」と同じく、重複は通知を埋める        |
| 取得中に報告すると古い件数を読む。無効化済みキャッシュは表示しながら再取得する                              | TanStack Query の `useSuspenseQuery` はデータがあれば Suspend せず、`isFetching` だけが立つ |
| `aria-busy` 単独では通知にならない                                                                          | ADR-0017 の検討案の表が却下                                                                 |

先行例は次のとおり (2026-09-23 に確認)。

| 先行例                                         | 形                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| WCAG 2.2 Understanding 4.1.3                   | Search ボタンの後に「5 results returned」を status として出す。技術は ARIA22 (`role="status"`)                                |
| GOV.UK accessible-autocomplete `src/status.js` | 常時 mount の `role="status"` を 2 つ交互に使い、結果数の文言を 1400ms の debounce で更新する。フォーカスが無いときは出さない |
| Base UI `Combobox.Status`                      | 「root は mount されたままでなければ一貫して読まれない」。children を更新して件数を伝える                                     |

どれも「読まれる要素を先に置き、内容の変化で通知する」形で、変化の検出は部品自身が持つ。この repo では読まれる要素が announcer なので、残るのは「変化をどこで検出し、重複をどこで除くか」だけである。

## Decision

**ページは条件の一覧が取得済みになるたびに `onResultsSettled(q, count)` で報告する。route component (wrapper) が直前に通知した条件を `useRef` で持ち、違うときだけ `announce()` で件数を通知する。初期表示は通知しない。**

| 規範                                                                                                                                                                                     | 守らないと何が壊れるか                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ページの報告は `useEffect` に置き、契機は条件 (`filter.q`) と決着 (`!notesQuery.isFetching`) の 2 つ。件数は `useEffectEvent` で最新値を読む                                             | 契機を deps から外すと通知が抜ける。件数を deps に入れると mutation の楽観行で余計に走る                                               |
| 取得中は報告しない                                                                                                                                                                       | 無効化済みキャッシュを表示しながら再取得する間に、古い件数を読み上げる                                                                 |
| 「最後に通知した条件」は wrapper (`NotesRoute`) の `useRef(q)` が持つ。ページに持たせない                                                                                                | ページは `key={q}` で作り直されるので、debounce が明ける前の Enter と戻るで通知が消える                                                |
| wrapper は直前の条件と違うときだけ通知し、同じ条件の報告 (背景 refetch、Strict Mode の二重 effect、同じ条件での作り直し) は捨てる                                                        | 同じ内容を 2 回読ませる。件数だけが変わる経路は mutation の通知が担う (ADR-0017)                                                       |
| 初期表示 (URL の `q`) は通知しない。`useRef(q)` の初期値が URL の `q` なので、最初の報告は同じ条件として捨てられる                                                                       | ページを開くたびに件数を読み上げる。結果の入れ替わりではない                                                                           |
| 文言は `noteSearchResultMessage` (`src/routes/notes/-lib/note-search.ts`) が持つ。0 件も件数の形で、条件が空なら解除の文言                                                               | 空状態の見出し (『…』に一致するメモはありません) と同じ文字列にすると、テストの `getByText` が live region と見出しの 2 要素に解決する |
| ページのテスト (`-components/notes-page.test.tsx`) は `onResultsSettled` の呼び出し (条件と件数、取得中は報告しない) を見て、wrapper のテストは実 router で `readAnnouncements()` を見る | 通知の可否は wrapper が決めるので、props 直渡しのページテストでは通知を検証できない                                                    |

## Consequences

- `NotesPage` の props は値 (`q`) とハンドラ (`onQueryChange` / `onResultsSettled`) の 3 つになる。ページは「この条件の一覧が取得済みで表示中」を報告するだけで、通知するかを知らない
- ADR-0017 の「呼び出し層」を広げる: mutation の通知は feature 側の `onMutate` / `onSuccess`、取得結果の通知は route component。どちらも部品は announce しない
- オフラインで `fetchStatus` が `paused` のときは `isFetching` が false なので古いキャッシュの件数を通知し、再接続後の再取得で件数が変わっても同じ条件なので通知し直さない。表示中の一覧と件数は一致しているので誤通知ではなく、`fetchStatus === "idle"` で見ると通知ゼロになるほうが悪い
- 通知が消える経路は wrapper の記憶を消す mutant で、取得中の報告は決着の条件を外す mutant で、それぞれ `route.test.tsx` と `-components/notes-page.test.tsx` が落ちることを 2026-09-23 に確認した。通知が重複する経路 (同一条件の比較を外す) を落とすテストは無い。同じ条件の 2 回目の報告が起きるのは背景 refetch だけで、テストで起こすには invalidate と決着の 2 段が要る

### 再評価の条件

- Base UI か shadcn が結果数の status 部品を出荷したら、announcer ではなくその部品で件数を出す形に寄せる (ADR-0017 の再評価条件と同じ)
- 一覧の状態が URL ではなくページ内に閉じる画面 (作り直しが無い) では、ページの effect と `useRef` だけで足りる。wrapper への持ち上げは `key` で作り直す画面に限る

## 検討した選択肢

| 案                                                                  | 評価                                                                                                            | 採否     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| ページが報告し、wrapper が記憶と通知を持つ                          | 記憶が URL の変化をまたいで残る。ページは props で受ける形のまま                                                | **採用** |
| ページの `useEffect` + `useRef` で通知まで持つ                      | `key={q}` の作り直しで記憶が消え、debounce 前の Enter と戻るで通知が落ちる (2026-09-23 のレビューで 3 名が指摘) | 却下     |
| 可視の件数を `role="status"` の要素で置く (WCAG の技術 ARIA22 の形) | ADR-0017 が項目の `role="status"` を却下している。作り直しで region が再生成され、初回の内容は読まれない        | 却下     |
| wrapper が URL の `q` の変化だけで通知する                          | 打鍵中の入れ替わり (debounce 後) が無音になる。GOV.UK は入力中も通知する                                        | 却下     |
| 記憶を `useSyncExternalStore` の store に置く                       | ADR-0017 が却下した理由 (Transition の中の store 更新) と同じ                                                   | 却下     |
| 通知しない (`aria-busy` と半透明だけ)                               | ADR-0017 の検討案の表が却下                                                                                     | 却下     |

## 出典

- WCAG 2.2 Understanding 4.1.3 Status Messages: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- WCAG 技術 ARIA22 (`role="status"`): <https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22>
- GOV.UK accessible-autocomplete `src/status.js`: <https://github.com/alphagov/accessible-autocomplete/blob/main/src/status.js>
- Base UI Combobox (`Combobox.Status` の JSDoc は同梱の `node_modules/@base-ui/react/combobox/status/ComboboxStatus.d.ts`): <https://base-ui.com/react/components/combobox>
- React docs「Resetting all state when a prop changes」: <https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes>
- React docs `useEffectEvent`: <https://react.dev/reference/react/useEffectEvent>
- TanStack Query `useSuspenseQuery` (Suspend の条件は `isPending`): <https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery>
