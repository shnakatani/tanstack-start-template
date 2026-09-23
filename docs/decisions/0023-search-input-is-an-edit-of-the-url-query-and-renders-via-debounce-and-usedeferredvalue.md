# ADR-0023: 検索の入力欄は URL の q に対する編集として持ち、debounce → useDeferredValue → useSuspenseQuery で描く

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0022 (絞り込み条件は URL が持つ)、ADR-0017 (Transition の既定と `useDeferredValue` の位置づけ)、ADR-0020 (楽観行の扱い)、ADR-0038 (取得結果の通知)、ADR-0051 (テスト)

## Context

絞り込み条件は URL が持つ (ADR-0022)。入力欄は URL とは別に打鍵中の値を持ち、打鍵に追従して一覧を描き直す。テンプレートとして示したいのは、ページのローディングを route loader の prefetch と `useSuspenseQuery` と `pendingComponent` で行う形を崩さずに打鍵へ追従する形で、`useDeferredValue` は ADR-0017 が「ローカルの非緊急化に使う」と位置づけたまま使う箇所が無かった。

制約は次のとおり。

- Suspense モードで queryKey を変えると、更新を Transition に包まない限り fallback に置き換わる (TanStack Query の Suspense ガイド「wrap your updates that change the QueryKey into startTransition」)。打鍵のたびに skeleton へ落ちる一覧は作らない
- 打鍵ごとに server function を呼ばない
- URL の `q` が変わったら (確定、戻る / 進む、Link) 入力欄はその値に揃う。React docs はこの同期を「`key` で作り直す」か「描画中に計算する」で行い、effect で setState しない
- 同じ画面の要素を作り直さない。確定のたびに入力欄が新しい要素になるとフォーカスが消える

## Decision

**入力欄の state は「URL の `q` が変わった世代に対する編集」として持ち、表示値は描画中に導く。編集そのものを debounce し、世代が一致する debounce 済みの編集だけを条件にして `useDeferredValue` → `useSuspenseQuery` に通す。**

| 規範                                                                                                                                                                                                                                 | 守らないと何が壊れるか                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q` が変わった回数を「世代」として描画中に導く (`useState` + prop の変化で更新。React docs「Adjusting some state when a prop changes」)。編集は `{ generation, text }` で持ち、表示値は世代が一致するときだけ `text`、それ以外は `q` | `key={q}` でページを作り直すと確定 (Enter) のたびに入力欄が新しい要素になりフォーカスが body へ落ちる (2026-09-23 に実測)。effect で setState すると 1 描画ぶん古い値が見える |
| 編集を `q` の値ではなく世代で紐付ける                                                                                                                                                                                                | 履歴が同じ値へ戻ったとき (abc → xyz を確定 → abc へ戻る)、値で照合すると確定済みの編集が復活する (2026-09-23 のレビューで指摘)                                                |
| debounce するのは編集そのもの (`useDebouncedValue(edit)`)。debounce 済みの編集も世代が一致するときだけ使い、違えば URL の `q` を条件にする                                                                                           | 文字列を debounce すると、確定や戻るで URL が変わった後も debounce 済みの古い値が生き残り、URL でも入力でもない第 3 の条件を描く                                              |
| 条件は `useDeferredValue` を通してから `useSuspenseQuery` の key にする                                                                                                                                                              | 無いと新しい key で Suspend した瞬間に Suspense が古い一覧を隠す (下の節)                                                                                                     |
| 入力欄の編集 (draft と debounce 済み) は URL / server function と同じ `noteListFilterSchema` で正規化する (trim / 上限)。正規化は入力の直後に 1 回で、下流はその値から導く                                                           | 正規化を下流の複数箇所で呼ぶと呼び忘れた経路が生の値で走る。`" abc"` と `"abc"` が別のキャッシュになる                                                                        |
| 入力と表示中の条件がずれている間 (正規化後の入力値と deferred な条件が違う。debounce の待ちと取得中) は一覧を `StaleContent` (`src/components/parts/stale-content.tsx`) で包み `aria-busy` + 半透明で残す                            | 古い一覧が新しい条件の結果に見える。React docs の `isStale` の形。生の文字列で比べると、submit で入力欄を揃えた直後に条件が同じまま印が出る                                   |
| submit では入力欄も正規化後の値に揃える (値が変わるときだけ setState)                                                                                                                                                                | URL が同じ (同じ条件で Enter) だと作り直しも遷移も起きず、trim と切り詰めが見えない                                                                                           |
| 楽観行 (追加中) は条件によらず一覧の先頭に出す (`toNoteRows` の合成順のまま)                                                                                                                                                         | 保存後の再取得で条件に合わなければ消える。追加中だけ条件で隠すと「追加したのに出ない」に見える                                                                                |

### `useDeferredValue` を外せない理由

`@tanstack/react-pacer` 0.23.0 の `useDebouncedValue` は `useState` の setter をそのまま、依存する `@tanstack/pacer` 0.22.0 の `Debouncer` (`setTimeout`) に渡し、`startTransition` を通さない (`react-pacer` の `dist/debouncer/useDebouncedState.js`、`pacer` の `dist/debouncer.js`。どちらにも `startTransition` の参照は無い)。debounce 後の値でそのまま `useSuspenseQuery` を呼ぶと緊急更新の中で Suspend し、Suspense が古い一覧を `display: none` で隠す。`src/routes/notes/-components/notes-page.test.tsx`「打鍵が止まってから 1 回だけ取得し、その間は古い一覧を半透明で残す」は古い行を `toBeVisible` で見て、この欠落を落とす (`toBeInTheDocument` では隠れた木も通る)。

React docs は debounce と `useDeferredValue` を「You can also use these techniques together」と併用可とし、debounce の役割を「fire fewer network requests」に置く。ここでの分担も同じで、debounce が取得回数を減らし、`useDeferredValue` が Suspense の fallback を防ぐ。

## Consequences

- `@tanstack/react-pacer` は beta で API が変わりうる (docs の overview「TanStack Pacer is currently in beta and its API is still subject to change」)。利用箇所は `NotesPage` の `useDebouncedValue` 1 つに閉じる。追従できない変更が来たら `use-debounce` の `useDebounce(value, wait)` に差し替える。差し替え後も `useDeferredValue` の段は残す
- 待ちの実値は `src/routes/notes/-lib/note-search.ts` の `NOTE_SEARCH_DEBOUNCE_MS`。テストは module の partial mock で広げるので literal 型に固めない (ADR-0051)
- 確定と戻るの直後は編集の世代が URL と合わないので、debounce の待ちを経ずに URL の条件 (loader が温めたキャッシュ) を描く
- ページは URL の変化をまたいで生き続けるので、結果の通知の記憶 (`useRef`) をページに置ける (ADR-0038)
- 打鍵中の再描画: `useDebouncedValue` は selector を渡さない限り store の購読で再描画しない。React Compiler の出力で `v.parse` は入力値ごとに memo され、`DataTable` は打鍵で作り直されない (2026-09-23 に oxc-transform-react で確認)

### 再評価の条件

- Pacer が 1.0 になったら beta の注記を消す。API が変わって追従できなければ上の差し替え先へ
- React か Router が「URL に対する編集」を扱う primitive を出したら、世代の管理をそちらへ寄せる

## 検討した選択肢

| 案                                                                                      | 評価                                                                                                                                                                       | 採否     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 編集を世代で紐付け、編集ごと debounce → `useDeferredValue` → `useSuspenseQuery`         | URL の変化で編集も debounce 済みの値も無効になり、要素を作り直さない                                                                                                       | **採用** |
| `key={q}` でページを作り直す                                                            | React docs の「全 state のリセット」の形だが、確定のたびに入力欄のフォーカスが消え、テーブルやダイアログの state も捨てる。通知の記憶を wrapper へ持ち上げる必要が生まれる | 却下     |
| 編集を `{ base: q, text }` で持ち、`base === q` で有効性を見る (2026-09-23 の中間版)    | 履歴が同じ値へ戻ると確定済みの編集が復活する                                                                                                                               | 却下     |
| 文字列を debounce し「入力欄が URL と同じなら待たない」特例を置く (2026-09-23 の中間版) | 確定や戻るの後に debounce 済みの古い文字列が第 3 の条件を描く。特例はその一部しか隠さない                                                                                  | 却下     |
| `useQuery` + `placeholderData: keepPreviousData`                                        | 古いデータを残せるが、`useSuspenseQuery` + `pendingComponent` の形から外れ、ページに `isPending` 分岐が戻る                                                                | 却下     |
| debounce を `useEffect` + `setTimeout` で手組みする                                     | effect 内の setState を lint が止める (`react/set-state-in-effect`)。Pacer と `use-debounce` が公式の形を持つ                                                              | 却下     |
| `use-debounce`                                                                          | 安定しているが、TanStack の同梱 (`@tanstack/react-pacer`) で足りる。Pacer の撤退先として残す                                                                               | 保留     |

## 出典

- TanStack Query の Suspense ガイド (queryKey の変更は `startTransition` に包む): <https://tanstack.com/query/latest/docs/framework/react/guides/suspense>
- TanStack Query の `packages/react-query/src/__tests__/transition.test.tsx` (`useDeferredValue` + `useSuspenseQuery` の形): <https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/transition.test.tsx>
- React docs `useDeferredValue` (Suspense 統合、debounce との併用、`isStale`): <https://react.dev/reference/react/useDeferredValue>
- React docs「Adjusting some state when a prop changes」: <https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes>
- TanStack Pacer の overview (beta の注記) と `useDebouncedValue`: <https://tanstack.com/pacer/latest/docs/overview> / <https://tanstack.com/pacer/latest/docs/framework/react/reference/functions/useDebouncedValue>
- 同梱の `@tanstack/react-pacer` 0.23.0 `dist/debouncer/useDebouncedState.js` と、その依存 `@tanstack/pacer` 0.22.0 `dist/debouncer.js` (`setState` を Transition に包まない)
- TanStack/router#3162 (search param に束縛した入力欄でカーソルが末尾へ跳ぶ。局所 state を挟む回避策): <https://github.com/TanStack/router/issues/3162>
