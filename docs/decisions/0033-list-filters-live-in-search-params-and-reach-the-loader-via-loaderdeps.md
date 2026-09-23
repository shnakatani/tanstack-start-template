# ADR-0033: 一覧の絞り込み条件は URL の search param が持ち、loaderDeps で loader に渡す

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0008 (ドメイン型は valibot スキーマから導出する)、ADR-0014 (ユーザー操作による更新は Transition を既定にする)、ADR-0016 (完了点とブロック範囲)、ADR-0012 (route 配下の `-lib/` と `-components/` の置き場)、ADR-0017 (状態の通知は live region の `announce()`)、ADR-0034 (取得結果の通知)

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

| 規範                                                                                                                                                                                                                                                                                                                                | 守らないと何が壊れるか                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 絞り込み条件の schema は `src/features/notes/schema.ts` の `noteListFilterSchema` 1 つで、server function の `.validator` と route の `validateSearch` が同じものを使う                                                                                                                                                             | 別々に持つと URL では通るのにサーバで落ちる (またはその逆) 組み合わせが生まれる。valibot 1.x は Standard Schema なので adapter は要らない                                                                                                                                                                   |
| 既定値は `search.middlewares` の `stripSearchParams(v.getDefaults(noteListFilterSchema))` (既定は schema から導く) で URL から落とす                                                                                                                                                                                                | `/notes` と `/notes?q=` が別の場所になり、履歴と link の比較が揺れる                                                                                                                                                                                                                                        |
| loader が読む search は `loaderDeps: ({ search }) => ({ q: search.q })` で宣言し、`loader` は options に直接書いて `notesQueryOptions(deps)` を温める (`context` と `deps` の型は推論される。関数に切り出すと引数の型を手で書くことになる: `typeof Route` は循環、`LoaderFnContext` は `AnyRoute` 経由で `any`)。検証は router 経由 | deps に無い search は loader に届かず、preload が別条件のデータを表示側に残す (Router docs の page 2 の例)                                                                                                                                                                                                  |
| `notesQueryOptions(filter)` の key は `[...NOTES_QUERY_KEY, filter]`。mutation の invalidate は `NOTES_QUERY_KEY` の前方一致のまま                                                                                                                                                                                                  | 条件ごとに key を分けないと、条件の異なる一覧が同じキャッシュを上書きする。invalidate を条件付き key にすると他の条件の一覧が古いまま残る                                                                                                                                                                   |
| Route hooks は route ファイル内の wrapper (`NotesRoute`) が吸収し、ページ本体 `NotesPage` (`-components/notes-page.tsx`) は値 (`q`) とハンドラ (`onQueryChange`) を props で受ける                                                                                                                                                  | Route hooks を混ぜるとページテストがテスト router で動かない (`.claude/rules/directory-structure.md`「ルートファイル」)                                                                                                                                                                                     |
| 入力欄の state は「URL の `q` に対する編集」`{ generation, text }` で持ち、`generation` は `q` が変わった回数 (prop の変化を描画中に導く)。表示値は世代が一致するときだけ `text`、それ以外は `q`。`key={q}` でページを作り直さない                                                                                                  | 作り直すと確定 (Enter) のたびに入力欄が新しい要素になりフォーカスが body へ落ちる (2026-09-23 に実測)。編集を `q` の値で紐付けると、履歴が同じ値へ戻ったとき確定済みの編集が復活する (2026-09-23 のレビューで指摘)。effect で setState すると 1 描画ぶん古い値が見える                                      |
| 入力値は緊急更新。debounce するのは編集 `{ generation, text }` そのもので、debounce 済みの編集も世代が一致するときだけ使い、違えば URL の `q` を条件にする。条件は `useDeferredValue` → `useSuspenseQuery` の順に通す                                                                                                               | debounce が無いと打鍵ごとに取得する。文字列を debounce すると、確定や戻るで URL が変わった後も debounce 済みの古い値が生き残り、URL でも入力でもない第 3 の条件を描く。`useDeferredValue` が無いと新しい key で Suspend した瞬間に Suspense が古い一覧を隠す                                                |
| `q` の上限は schema が reject せず切り詰める (`v.transform` + `truncateCodeUnits`)。入力欄の編集 (draft と debounce 済み) も同じ schema で正規化する。入力欄は `maxLength` を持つ                                                                                                                                                   | search param は malformed でも体験を止めない (Router の search-params ガイド)。reject すると IME の変換中など maxLength が効かない経路 (facebook/react#8683、Chromium 40520211) で `useSuspenseQuery` が throw し一覧ごと Error Boundary に落ちる。trim しないと `" abc"` と `"abc"` が別のキャッシュになる |
| 結果の入れ替わりの通知はページの effect が取得の決着で `announce()` する (ADR-0034)                                                                                                                                                                                                                                                 | `aria-busy` と半透明は読み上げに出ない。契機と重複除去は ADR-0034 が持つ                                                                                                                                                                                                                                    |
| 入力と表示中の条件がずれている間 (正規化後の入力値と `deferredQ` が違う。debounce の待ちと取得中) は一覧を `StaleContent` で包み `aria-busy` + 半透明で残す                                                                                                                                                                         | 古い一覧が新しい条件の結果に見える。React docs の `isStale` の形。生の文字列で比べると、submit で入力欄を揃えた直後に条件が同じまま印が出る                                                                                                                                                                 |
| URL への確定は form の submit だけで、`navigate` は `replace: true` (履歴を積まない)。debounce 後の値を effect で URL へ書かない                                                                                                                                                                                                    | 検索は同じ画面の絞り込みで新しい目的地ではない。push にすると戻るが検索を 1 回ずつ巻き戻し、画面を出るのに検索の回数だけ戻ることになる (nuqs は `history` の既定を `replace` にし、push はタブやモーダルのようにナビゲーションに相当するときだけと限定する)。打鍵ごとに書くと履歴と loader が動く           |
| サーバ側は `likeContains(column, text)` (`src/server/db/like-pattern.ts`) が `column LIKE ? ESCAPE ?` を組み、`%` `_` `\` をエスケープしたパターンを bind する                                                                                                                                                                      | 利用者の `%` がワイルドカードとして効き、`_` が任意の 1 文字に一致する。呼び出し側でパターンと `ESCAPE` を手で組むと、対で渡す規約を忘れた検索が黙って壊れる                                                                                                                                                |
| 楽観行 (追加中) は条件によらず一覧の先頭に出す (`toNoteRows` の合成順のまま)                                                                                                                                                                                                                                                        | 保存後の再取得で条件に合わなければ消える。追加中だけ条件で隠すと「追加したのに出ない」に見える                                                                                                                                                                                                              |

### wrapper のテストは root を差し替えた route tree で描く

生成済み `routeTree.gen.ts` は `__root.tsx` が `TanStackDevtools` と `<html>` を描き、browser test では "Invalid hook call" と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。`src/routes/notes/index.test.tsx` は root だけを `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` に差し替え、`Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree` をそのまま `createMemoryHistory` で描く形を示す。root が devtools を持たないプロジェクトではその形で足りる。

### `useDeferredValue` を外せない理由

`@tanstack/react-pacer` 0.23.0 の `useDebouncedValue` は `useState` の setter をそのまま `@tanstack/react-pacer` 0.23.0 が依存する `@tanstack/pacer` 0.22.0 の `Debouncer` (`setTimeout`) に渡し、`startTransition` を通さない (`react-pacer` の `dist/debouncer/useDebouncedState.js`、`pacer` の `dist/debouncer.js`。どちらにも `startTransition` の参照は無い)。debounce 後の値でそのまま `useSuspenseQuery` を呼ぶと緊急更新の中で Suspend し、Suspense が古い一覧を `display: none` で隠す。`src/routes/notes/-components/notes-page.test.tsx`「打鍵が止まってから 1 回だけ取得し、その間は古い一覧を半透明で残す」は古い行を `toBeVisible` で見て、この欠落を落とす (`toBeInTheDocument` では隠れた木も通る)。

React docs は debounce と `useDeferredValue` を「You can also use these techniques together」と併用可とし、debounce の役割を「fire fewer network requests」に置く。ここでの分担も同じで、debounce が取得回数を減らし、`useDeferredValue` が Suspense の fallback を防ぐ。

## Consequences

- `@tanstack/react-pacer` は beta で API が変わりうる (docs の overview「TanStack Pacer is currently in beta and its API is still subject to change」)。利用箇所は `NotesPage` の `useDebouncedValue` 1 つに閉じる。追従できない変更が来たら `use-debounce` の `useDebounce(value, wait)` に差し替える。差し替え後も `useDeferredValue` の段は残す
- landmark は `<search>` 要素で組む。同梱の `@vitest/browser` の locator engine が `search` role を `<search>` に写さないため (2026-09-23 に実測)、部品のテストは `getByRole("search")` ではなく要素名で見る。本番のマークアップをテスト側の欠落に合わせない
- ページテスト (`-components/notes-page.test.tsx`) は `NotesPage` に props を直接渡す。wrapper の往復 (URL → 入力欄、Enter → URL、空で確定 → `q` が消える、上限超え → 切り詰め、文字列以外 → error component) は `index.test.tsx` が持つ
- debounce のテストは 1 文字ずつ別の `userEvent.keyboard` で打つ。`fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)。待ちの実値 (`NOTE_SEARCH_DEBOUNCE_MS`) は `mise run verify` の負荷で打鍵の間隔に負けるので、テストは module の partial mock で待ちを広げる (`-components/notes-page.test.tsx` の `vi.mock`)
- valibot 1.4.2 に文字列を切り詰める action は無い (`toMaxValue` は辞書順の置換、長さ系は検証のみ。2026-09-23 に同梱の型定義で確認)。切り詰めは `truncateCodeUnits` が持つ
- 切り詰めは warn しない。IME の変換中に上限を超えるのは通常の入力で、warn にすると日本語入力のたびに鳴る誤検知になる。切り詰めは maxLength と同じ規則を先に当てるだけで、submit では入力欄に反映して見せる。切った位置がサロゲートペアの途中なら前半を落とす。落とさないと URL では U+FFFD に化け、`LIKE` にも当たらない (2026-09-23 に better-sqlite3 で実測)
- 通知の契機と重複除去は ADR-0034 が持つ。テストは `-components/notes-page.test.tsx` が debounce 後と無効化済みキャッシュの決着を、`index.test.tsx` が Enter と戻るの通知とフォーカスの維持を見る
- submit の `navigate` を push に変えても URL は同じなので、履歴の数を見るテスト (`index.test.tsx`「入力して Enter すると URL の q が確定する」の `router.history.length`) が無いと退行に気付けない。同じ画面で `q` が別の値に変わる経路 (Link、他画面からの戻る) は route テストが `router.navigate` で作る
- URL の `q` は Router の既定の search パーサが JSON として先に読むので、手で書いた `?q=123` `?q=true` は number / boolean になり schema が落とす (アプリ内の navigate は `?q=%22123%22` に包むので往復は保たれる)。schema の `v.string()` に日本語の文言を持たせ、error component に技術文言を出さない。coerce やパーサの差し替えはしない: 他の route の search にも波及し、数値を検索したい利用者が URL を手で書く経路のためだけに既定を外す理由が無い
- search の検証失敗 (文字列以外の `q`) は `/notes` の route 境界に落ちる。上限超えは切り詰めるので落ちない。dev server で `/notes?q=<101 文字>` を SSR したとき (reject していた 2026-09-23 の初版) は HTTP 500 で `RouteErrorContent` (見出し「エラーが発生しました」、DEV では Standard Schema の issues の JSON を持つ `error.message`) が描かれ、root の全画面エラーにはならなかった。route テストは `defaultErrorComponent` を本番と同じ `RouteErrorContent` にし、`?q=123` で見出しと schema の文言を見る

### 再評価の条件

- Pacer が 1.0 になったら beta の注記を消す。API が変わって追従できなければ上の差し替え先へ
- drizzle-orm が `like` のエスケープ helper を出荷したら (drizzle-team/drizzle-orm#444)、`likeContains` を置き換える
- `__root.tsx` が browser test で描けるようになったら、`index.test.tsx` を生成済み `routeTree` で描く形 (how-to の形) に戻す

## 検討した選択肢

| 案                                                                               | 評価                                                                                                                                                           | 採否     |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| search param + `loaderDeps` + debounce → `useDeferredValue` → `useSuspenseQuery` | URL が state なので共有と戻るが効く。Suspense の規範を保ったまま fallback を防げる。Router の公式形 (`loaderDeps`) に乗る                                      | **採用** |
| `useQuery` + `placeholderData: keepPreviousData`                                 | 古いデータを残せるが、`useSuspenseQuery` + `pendingComponent` の規範 (`.claude/rules/styling.md`) から外れ、ページに `isPending` 分岐が戻る                    | 却下     |
| 打鍵ごとに URL へ `navigate` する                                                | Router の Transition に乗るが、1 文字ごとに loader と履歴が動く。`replace` にしても loader は走る                                                              | 却下     |
| submit を push にする (2026-09-23 の中間版)                                      | 明示操作 1 回につき履歴 1 つという理由で採ったが、検索は同じ画面の絞り込みで、戻るが検索を 1 回ずつ巻き戻す。URL state の先行例 (nuqs) は replace を既定にする | 却下     |
| debounce 後の値を effect で URL へ書く                                           | effect で navigate する形になり、確定の主体が曖昧になる。URL の変更は利用者の操作 (submit) に対応させる                                                        | 却下     |
| debounce を `useEffect` + `setTimeout` で手組みする                              | effect 内の setState を lint が止める (`react/set-state-in-effect`)。Pacer と `use-debounce` が公式の形を持つ                                                  | 却下     |
| `use-debounce`                                                                   | 安定しているが、TanStack の同梱 (`@tanstack/react-pacer`) で足りる。Pacer の撤退先として残す                                                                   | 保留     |
| クライアント側で絞り込む (全件取得して filter)                                   | 件数が増えると全件取得が重く、URL に条件を持つ意味が薄い。サーバ側の LIKE と `loaderDeps` の実例にもならない                                                   | 却下     |
| 上限超えの `q` を schema で reject する (2026-09-23 の初版)                      | URL 経路は error component、入力欄経路は別の緩い正規化が要り、厳格と緩和の 2 段になる。Router のガイドは fallback を勧める                                     | 却下     |
| `<form role="search">` (2026-09-23 の初版)                                       | locator engine が `<search>` を role に写さない欠落を本番のマークアップで吸収し、lint 抑制と再評価条件を積む                                                   | 却下     |

## 出典

- TanStack Router の search-params ガイド (Standard Schema、`stripSearchParams`、search middlewares): <https://tanstack.com/router/latest/docs/framework/react/guide/search-params>
- TanStack Router の data-loading ガイド「Using loaderDeps to access search params」: <https://tanstack.com/router/latest/docs/framework/react/guide/data-loading>
- TanStack Router の how-to「How to Test Router with File-Based Routing」: <https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing>
- TanStack Query の Suspense ガイド (queryKey の変更は `startTransition` に包む): <https://tanstack.com/query/latest/docs/framework/react/guides/suspense>
- TanStack Query の `packages/react-query/src/__tests__/transition.test.tsx` (`useDeferredValue` + `useSuspenseQuery` の形): <https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/transition.test.tsx>
- React docs `useDeferredValue` (Suspense 統合、debounce との併用、`isStale`): <https://react.dev/reference/react/useDeferredValue>
- React docs「Adjusting some state when a prop changes」(描画中に計算する形): <https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes>
- TanStack Pacer の overview (beta の注記) と `useDebouncedValue`: <https://tanstack.com/pacer/latest/docs/overview> / <https://tanstack.com/pacer/latest/docs/framework/react/reference/functions/useDebouncedValue>
- 同梱の `@tanstack/react-pacer` 0.23.0 `dist/debouncer/useDebouncedState.js` と、その依存 `@tanstack/pacer` 0.22.0 `dist/debouncer.js` (`setState` を Transition に包まない)
- SQLite の `LIKE` (ASCII のみ case-insensitive、`ESCAPE`): <https://sqlite.org/lang_expr.html#like>
- drizzle-team/drizzle-orm#444 (`like` へのエスケープ helper の要望。open): <https://github.com/drizzle-team/drizzle-orm/issues/444>
- HTML Standard「maxlength」(防止は may): <https://html.spec.whatwg.org/multipage/input.html#attr-input-maxlength>
- facebook/react#8683 (IME の変換中に change が走る) / Chromium 40520211 (変換中に外をクリックすると maxlength を超えたまま確定する): <https://github.com/facebook/react/issues/8683> / <https://issues.chromium.org/issues/40520211>
- nuqs `history` option (既定 `replace`。push はナビゲーションに相当するときだけ): <https://nuqs.dev/docs/options>
- TanStack/router#3162 (search param に束縛した入力欄でカーソルが末尾へ跳ぶ。局所 state を挟む回避策): <https://github.com/TanStack/router/issues/3162>
