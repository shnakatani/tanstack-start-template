# ADR-0033: 一覧の絞り込み条件は URL の search param が持ち、loaderDeps で loader に渡す

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0008 (ドメイン型は valibot スキーマから導出する)、ADR-0014 (ユーザー操作による更新は Transition を既定にする)、ADR-0016 (完了点とブロック範囲)、ADR-0012 (route 配下の `-lib/` と `-components/` の置き場)、ADR-0017 (状態の通知は live region の `announce()`)

## Context

`/notes` の一覧に title の部分一致で絞り込む検索欄を足す。テンプレートとして示したいのは次の 2 つで、どちらも 2026-09-23 時点の `src/` に実例が無かった。

- Route hooks (`Route.useSearch` / `Route.useNavigate`) を吸収する wrapper と、その wrapper を実 router で動かすテスト (`.claude/rules/directory-structure.md`「ルートファイル」が規範として持つが実例が無かった)
- 打鍵に追従する一覧を、`useSuspenseQuery` の規範 (`.claude/rules/styling.md`「状態表示」) を崩さずに描く形。`useDeferredValue` は ADR-0014 が「ローカルの非緊急化に使う」と位置づけたまま、使う箇所が無かった

制約は次のとおり。

- 一覧のデータは Query が所有し、loader は Query を温めるだけ (`.claude/rules/directory-structure.md`「ルートファイル」)。絞り込み条件が変わっても loader の値を `useLoaderData` で読む形にはしない
- Suspense モードで queryKey を変えると、更新を Transition に包まない限り fallback に置き換わる (TanStack Query の Suspense ガイド「wrap your updates that change the QueryKey into startTransition」)。打鍵のたびに skeleton へ落ちる一覧は作らない
- Router は search param を loader へ直接渡さない。loader が読む search は `loaderDeps` で宣言し、deps の組み合わせごとに別のキャッシュになる (Router の data-loading ガイド「Using loaderDeps to access search params」)
- SQLite の `LIKE` は ASCII の英字だけ大文字小文字を区別しない (sqlite.org「SQLite only understands upper/lower case for ASCII characters by default」)。`%` `_` はワイルドカードなので、利用者の入力をそのまま渡すと意図しない一致が起きる

## Decision

**絞り込み条件は URL の search param `q` が持つ。route が schema で検証し、`loaderDeps` で loader へ渡す。入力欄は打鍵を debounce してから `useDeferredValue` に通し、`useSuspenseQuery` の key にする。URL への確定は submit (Enter / 検索ボタン) だけが行う。**

| 規範                                                                                                                                                                                     | 守らないと何が壊れるか                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 絞り込み条件の schema は `src/features/notes/schema.ts` の `noteListFilterSchema` 1 つで、server function の `.validator` と route の `validateSearch` が同じものを使う                  | 別々に持つと URL では通るのにサーバで落ちる (またはその逆) 組み合わせが生まれる。valibot 1.x は Standard Schema なので adapter は要らない                                              |
| 既定値は `search.middlewares` の `stripSearchParams({ q: "" })` で URL から落とす                                                                                                        | `/notes` と `/notes?q=` が別の場所になり、履歴と link の比較が揺れる                                                                                                                   |
| loader が読む search は `loaderDeps: ({ search }) => ({ q: search.q })` で宣言し、`loadNotesPageData({ context, deps })` が `notesQueryOptions(deps)` を温める                           | deps に無い search は loader に届かず、preload が別条件のデータを表示側に残す (Router docs の page 2 の例)                                                                             |
| `notesQueryOptions(filter)` の key は `[...NOTES_QUERY_KEY, filter]`。mutation の invalidate は `NOTES_QUERY_KEY` の前方一致のまま                                                       | 条件ごとに key を分けないと、条件の異なる一覧が同じキャッシュを上書きする。invalidate を条件付き key にすると他の条件の一覧が古いまま残る                                              |
| Route hooks は route ファイル内の wrapper (`NotesRoute`) が吸収し、ページ本体 `NotesPage` は `q` と `onQueryChange` を props で受ける named export                                       | Route hooks を混ぜるとページテストがテスト router で動かない (`.claude/rules/directory-structure.md`「ルートファイル」)                                                                |
| URL の `q` が変わったら wrapper が `key={q}` でページを作り直し、入力欄の state を `q` に揃える                                                                                          | effect で setState すると 1 描画ぶん古い値が見える (`.claude/rules/implementation.md`「useEffect 内で setState 禁止」)                                                                 |
| 入力値 `text` は緊急更新。一覧は `useDebouncedValue(text, { wait: NOTE_SEARCH_DEBOUNCE_MS })` → `useDeferredValue` → `useSuspenseQuery` の順に通す                                       | debounce が無いと打鍵ごとに取得する。`useDeferredValue` が無いと新しい key で Suspend した瞬間に Suspense が古い一覧を隠す                                                             |
| 入力欄の値は key にする前に `toNoteListFilter` (`src/routes/notes/-lib/note-search.ts`) で URL と同じ正規化 (trim / 上限で切る) を通す。入力欄は `maxLength` を持つ                      | trim しないと `" abc"` と `"abc"` が別のキャッシュになる。上限超えを schema に通すと `useSuspenseQuery` が throw し、一覧ごと Error Boundary に落ちる                                  |
| 条件が確定して結果が入れ替わったら `announce()` で件数を通知する (`noteSearchResultMessage`)。mount 時 (初期表示と `key={q}` の作り直し) は通知しない                                    | `aria-busy` と半透明は読み上げに出ない (ADR-0017 が「`aria-busy` だけで伝える」を却下)。通知は live region への DOM 副作用なので effect に置き、件数は `useEffectEvent` で最新値を読む |
| 入力と表示中の条件がずれている間 (`text !== deferredText`。debounce の待ちと取得中) は一覧を `StaleContent` で包み `aria-busy` + 半透明で残す                                            | 古い一覧が新しい条件の結果に見える。React docs の `isStale` の形                                                                                                                       |
| URL への確定は form の submit だけで、`navigate` は履歴を積む (push)。debounce 後の値を effect で URL へ書かない                                                                         | 打鍵ごとに書くと履歴と loader が動き、戻るボタンが 1 文字ずつ戻る。submit を replace にすると、戻るで絞り込み前の一覧に戻れない                                                        |
| サーバ側は `title LIKE ? ESCAPE '\'` で、bind する値は `%` + `escapeLikePattern(q)` + `%` の 1 つ。`escapeLikePattern` (`src/server/db/like-pattern.ts`) が `%` `_` `\` をエスケープする | 利用者の `%` がワイルドカードとして効き、`_` が任意の 1 文字に一致する                                                                                                                 |
| 楽観行 (追加中) は条件によらず一覧の先頭に出す (`toNoteRows` の合成順のまま)                                                                                                             | 保存後の再取得で条件に合わなければ消える。追加中だけ条件で隠すと「追加したのに出ない」に見える                                                                                         |

### wrapper のテストは root を差し替えた route tree で描く

生成済み `routeTree.gen.ts` は `__root.tsx` が `TanStackDevtools` と `<html>` を描き、browser test では "Invalid hook call" と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。`src/routes/notes/route.test.tsx` は root だけを `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` に差し替え、`Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree` をそのまま `createMemoryHistory` で描く形を示す。root が devtools を持たないプロジェクトではその形で足りる。

### `useDeferredValue` を外せない理由

`@tanstack/react-pacer` 0.23.0 の `useDebouncedValue` は `useState` の setter をそのまま `@tanstack/pacer` の `Debouncer` (`setTimeout`) に渡し、`startTransition` を通さない (`react-pacer` の `dist/debouncer/useDebouncedState.js`、`pacer` の `dist/debouncer.js`。どちらにも `startTransition` の参照は無い)。debounce 後の値でそのまま `useSuspenseQuery` を呼ぶと緊急更新の中で Suspend し、Suspense が古い一覧を `display: none` で隠す。`src/routes/notes/index.test.tsx`「打鍵が止まってから 1 回だけ取得し、その間は古い一覧を半透明で残す」は古い行を `toBeVisible` で見て、この欠落を落とす (`toBeInTheDocument` では隠れた木も通る)。

React docs は debounce と `useDeferredValue` を「You can also use these techniques together」と併用可とし、debounce の役割を「fire fewer network requests」に置く。ここでの分担も同じで、debounce が取得回数を減らし、`useDeferredValue` が Suspense の fallback を防ぐ。

## Consequences

- `@tanstack/react-pacer` は beta で API が変わりうる (docs の overview「TanStack Pacer is currently in beta and its API is still subject to change」)。利用箇所は `NotesPage` の `useDebouncedValue` 1 つに閉じる。追従できない変更が来たら `use-debounce` の `useDebounce(value, wait)` に差し替える。差し替え後も `useDeferredValue` の段は残す
- `<search>` 要素は使わず `<form role="search">` で組む。同梱の `@vitest/browser` の locator engine が `search` role を `<search>` に写さないため、`getByRole("searchbox")` は取れても `getByRole("search")` が取れない (2026-09-23 に実測。理由は `note-search-field.tsx` の抑制コメントが持つ)
- ページテスト (`index.test.tsx`) は `NotesPage` に props を直接渡す。wrapper の往復 (URL → 入力欄、Enter → URL、空で確定 → `q` が消える、上限超え → error component) は `route.test.tsx` が持つ
- debounce のテストは 1 文字ずつ別の `userEvent.keyboard` で打つ。`fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)
- submit の `navigate` を `replace: true` に変えても URL は同じなので、履歴の数を見るテスト (`route.test.tsx`「入力して Enter すると URL の q が確定する」の `router.history.length`) が無いと退行に気付けない
- URL の `q` は Router の既定の search パーサが JSON として先に読むので、手で書いた `?q=123` `?q=true` は number / boolean になり schema が落とす (アプリ内の navigate は `?q=%22123%22` に包むので往復は保たれる)。schema の `v.string()` に日本語の文言を持たせ、error component に技術文言を出さない。coerce やパーサの差し替えはしない: 他の route の search にも波及し、数値を検索したい利用者が URL を手で書く経路のためだけに既定を外す理由が無い
- search の検証失敗は `/notes` の route 境界に落ちる。dev server で `/notes?q=<101 文字>` を SSR すると HTTP 500 で `RouteErrorContent` (見出し「エラーが発生しました」、DEV では Standard Schema の issues の JSON を持つ `error.message`) が描かれ、root の全画面エラーにはならない (2026-09-23 に実測)。route テストは `defaultErrorComponent` を本番と同じ `RouteErrorContent` にし、見出しと schema の文言を見る

### 再評価の条件

- Pacer が 1.0 になったら beta の注記を消す。API が変わって追従できなければ上の差し替え先へ
- `@vitest/browser` の locator engine が `search` role を `<search>` に写すようになったら `<form role="search">` を `<search>` に戻す
- `__root.tsx` が browser test で描けるようになったら、`route.test.tsx` を生成済み `routeTree` で描く形 (how-to の形) に戻す

## 検討した選択肢

| 案                                                                               | 評価                                                                                                                                        | 採否     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| search param + `loaderDeps` + debounce → `useDeferredValue` → `useSuspenseQuery` | URL が state なので共有と戻るが効く。Suspense の規範を保ったまま fallback を防げる。Router の公式形 (`loaderDeps`) に乗る                   | **採用** |
| `useQuery` + `placeholderData: keepPreviousData`                                 | 古いデータを残せるが、`useSuspenseQuery` + `pendingComponent` の規範 (`.claude/rules/styling.md`) から外れ、ページに `isPending` 分岐が戻る | 却下     |
| 打鍵ごとに URL へ `navigate` する                                                | Router の Transition に乗るが、1 文字ごとに loader と履歴が動く。`replace` にしても loader は走る                                           | 却下     |
| debounce 後の値を effect で URL へ書く                                           | effect で navigate する形になり、確定の主体が曖昧になる。URL の変更は利用者の操作 (submit) に対応させる                                     | 却下     |
| debounce を `useEffect` + `setTimeout` で手組みする                              | effect 内の setState を lint が止める (`react/set-state-in-effect`)。Pacer と `use-debounce` が公式の形を持つ                               | 却下     |
| `use-debounce`                                                                   | 安定しているが、TanStack の同梱 (`@tanstack/react-pacer`) で足りる。Pacer の撤退先として残す                                                | 保留     |
| クライアント側で絞り込む (全件取得して filter)                                   | 件数が増えると全件取得が重く、URL に条件を持つ意味が薄い。サーバ側の LIKE と `loaderDeps` の実例にもならない                                | 却下     |
| `<search>` 要素                                                                  | 意味論は正しいが、locator engine が role に写さないのでテストから掴めない                                                                   | 却下     |

## 出典

- TanStack Router の search-params ガイド (Standard Schema、`stripSearchParams`、search middlewares): <https://tanstack.com/router/latest/docs/framework/react/guide/search-params>
- TanStack Router の data-loading ガイド「Using loaderDeps to access search params」: <https://tanstack.com/router/latest/docs/framework/react/guide/data-loading>
- TanStack Router の how-to「How to Test Router with File-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing>
- TanStack Query の Suspense ガイド (queryKey の変更は `startTransition` に包む): <https://tanstack.com/query/latest/docs/framework/react/guides/suspense>
- TanStack Query の `packages/react-query/src/__tests__/transition.test.tsx` (`useDeferredValue` + `useSuspenseQuery` の形): <https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/transition.test.tsx>
- React docs `useDeferredValue` (Suspense 統合、debounce との併用、`isStale`): <https://react.dev/reference/react/useDeferredValue>
- React docs「Resetting all state when a prop changes」: <https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes>
- TanStack Pacer の overview (beta の注記) と `useDebouncedValue`: <https://tanstack.com/pacer/latest/docs/overview> / <https://tanstack.com/pacer/latest/docs/framework/react/reference/functions/useDebouncedValue>
- 同梱の `@tanstack/react-pacer` 0.23.0 `dist/debouncer/useDebouncedState.js` と `@tanstack/pacer` `dist/debouncer.js` (`setState` を Transition に包まない)
- SQLite の `LIKE` (ASCII のみ case-insensitive、`ESCAPE`): <https://sqlite.org/lang_expr.html#like>
