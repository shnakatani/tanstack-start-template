# 一覧・絞り込み・検索

一覧テーブル、URL の search param による絞り込み、打鍵に追従する検索欄を組むときの手順と、その形にしている理由を持つ。

| 決定                                                                                                                              | ADR      |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 一覧テーブルは TanStack Table v9 の列定義で組み、描画は registry の Table に残す                                                  | ADR-0018 |
| 一覧の絞り込み条件は URL の search param が持ち、loaderDeps で loader に渡す                                                      | ADR-0019 |
| ページは URL の変化で作り直さず、取得結果の入れ替わりはページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない | ADR-0027 |

## how-to

### 一覧テーブルを組む

ページは `DataTable` (`src/components/parts/data-table.tsx`) に列定義と data を渡す。列定義や table の設定を触るときは、同梱の skill `@tanstack/react-table#getting-started` と `@tanstack/table-core#core` / `#table-features` / `#typescript` を load する。v8 の `useReactTable` の形は書かない。

| 対象                 | 組み方                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列定義の置き場       | その画面だけの列は `routes/<path>/-lib/<画面>-columns.ts` (JSX を持たない設定)。描画を持つ列は、`cell` に `-components/` の部品の参照を渡す (`FlexRender` が cell の context を props にして描く。[TanStack Table docs「FlexRender」][])。ドメインをまたいで使う列は `src/features/<domain>/`                                                                                                                                                                                                                                                                 |
| 型                   | features は `src/components/parts/data-table-features.ts` に 1 つ置き、`createColumnHelper<DataTableFeatures, Row>()` と `helper.columns([...])` で定義する。`ColumnDef[]` の注釈で値の型を広げない。cell の見た目は列の `cell` 部品の中の素の要素に書く ([shadcn docs「Data Table」][] の Cell Formatting と同じ形)。td へ class を写す meta は持たない。td の className は動的になり `require-static-classes` が落とす (ADR-0022)                                                                                                                           |
| 行の型               | 確定行と保存中の行を `kind` で見分ける union にする。cell が `kind` で分岐するので、楽観行も同じ列定義で描ける。行モデルは画面の描画の形なので route の `-lib/` に置き、mutation の variables を絞る parser は `src/features/<domain>/` に置く                                                                                                                                                                                                                                                                                                                |
| data の組み立て      | ページが純粋関数 (単体テスト付き) で組んで `DataTable` に渡す。派生値は hook より後ろで作る。hook の間に挟むと React Compiler が scope を切れず、毎 render 新しい参照になる。`useMemo` は書かない (ADR-0014)。`getRowId` で `creating-<submittedAt>` / `saved-<id>` を付け、React の key にも使う                                                                                                                                                                                                                                                             |
| 描画                 | `DataTable` が `table.getHeaderGroups()` / `row.getAllCells()` と `<table.FlexRender>` で描く。`DataTable` から `Table*` へ `className` を渡さない (ADR-0020)。行の `aria-busy` はページが `rowProps` で `row.original` から決め、半透明は registry の `TableRow` (`ui/table.tsx`) が `aria-busy` から当てる。`rowProps` に `className` を通さない。コールバックの中の class は `no-restyle` が追えず、`<TableRow>` へ直接書けば落ちる class が診断なしで通る (ADR-0022)。空状態の案内はページの `Empty` 部品が持ち、`DataTable` の空行は単体で使うときの既定 |
| features             | 使う機能だけを登録する。sorting / pagination を足すときは、対応する feature と row model を足し、楽観行の出入りで data が変わるたびにページが戻らないよう `autoResetPageIndex` を見直す                                                                                                                                                                                                                                                                                                                                                                       |
| cell への関数        | module 定数は import で足りる。削除確認の handle は `-lib/` の module が持ち、trigger を描く cell 部品 (`-components/`) と Root を描くページの両方がそこに依存する (列定義 → cell 部品 → handle の向き)。Root の実体が共有部品 (`DeleteConfirmDialog`) なら wrapper を挟まない。cell が画面の callback を要するようになったら `tableMeta` (`metaHelper`) で渡す                                                                                                                                                                                               |
| devtools             | `DataTable` が `tableKey` を `useTable` の `key` に渡し、`useTanStackTableDevtools(table)` を直後に呼ぶ。`RootComponent` の `TanStackDevtools` に `tableDevtoolsPlugin()` を並べる                                                                                                                                                                                                                                                                                                                                                                            |
| 列見出しの定数       | 列の順・id・見出しは、ページ本体と pending 表示が共有する `-lib/` の定数 (`<列見出しの定数>`) だけが持つ。列の id をキーにした `as const` の object にし、`satisfies Partial<Record<keyof <ドメイン型>, string>> & { <表示用の列の id>: string }` のように、キーをドメイン型のフィールド名と表示用の列に限る。キーの typo は型が止める。キーと値 (項目の呼称) の対応は、値がどれも `string` なので型では見られない                                                                                                                                            |
| 列定義の id と見出し | 列定義は `columnBaseFrom(<列見出しの定数>)` (`src/components/parts/data-table-columns.ts`) が返す関数に id を渡し、`{ id, header }` を得て組む。id の typo は型が止め、見出しは写さない。戻り値は注釈で広げず、TanStack Table の `IdIdentifier` を `satisfies` で検査する (同梱 skill [`@tanstack/table-core` の `skills/typescript/SKILL.md`][] は、広い注釈で列の型を消すことを誤りに挙げる)。列の過不足と順序のずれは、pending の見出しと列定義の `header` を比べるテストが見る                                                                            |
| loading              | `TableSkeleton` の `headers` は `Object.values(<列見出しの定数>)` から採り、列定義から採らない。`pendingComponent` は code-split されず、import した列定義の cell 部品ごと main bundle に入る (ADR-0010)。支援技術への見せ方は `docs/guides/accessibility.md`「読み込み中の表示を組む」                                                                                                                                                                                                                                                                       |

### 絞り込み条件を URL に置く

ADR-0019 に沿って、次のように組む。

| 対象      | 組み方                                                                                                                                                                                                                                                                 | 守らないと                                                                                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| schema    | 絞り込み条件の schema は `src/features/<domain>/schema.ts` に 1 つ置き、server function の `.validator` と route の `validateSearch` が同じものを使う。valibot 1.x は Standard Schema なので adapter は要らない                                                        | URL では通るのにサーバで落ちる (またはその逆の) 組み合わせが生まれる                                                                                                                                                                                                                                         |
| 既定値    | `search.middlewares` の `stripSearchParams(v.getDefaults(<絞り込みの schema>))` で URL から落とす。既定は schema から導く                                                                                                                                              | `/<path>` と `/<path>?q=` が別の場所になり、履歴と link の比較が揺れる。既定を写すと schema と別々に動く                                                                                                                                                                                                     |
| loader    | loader が読む search は `loaderDeps: ({ search }) => ({ q: search.q })` で宣言し、`loader` は options に直接書いて、`deps` から組んだ一覧の `queryOptions` の取得を待つ。検証は router 経由 (`docs/guides/testing/route-wrappers.md`「route の wrapper をテストする」) | deps に無い search は loader に届かず、preload が別条件のデータを表示側に残す ([TanStack Router docs「Data Loading」][] の「Using Search Params in Loaders」の page 2 の例)。loader を関数に切り出すと、引数の型を手で書くことになる (`typeof Route` は循環し、`LoaderFnContext` は `AnyRoute` 経由で `any`) |
| query key | 一覧の `queryOptions` の key は `[...<一覧の key>, filter]` にする。mutation の invalidate は `<一覧の key>` の前方一致のまま                                                                                                                                          | 条件ごとに key を分けないと、条件の違う一覧が同じキャッシュを上書きする。invalidate を条件付きの key にすると、他の条件の一覧が古いまま残る                                                                                                                                                                  |

### 検索の入力欄を組む

入力欄の state は「URL の `q` が変わった世代に対する編集」として持ち、表示値は描画中に導く。編集そのものを debounce し、世代が一致する debounce 済みの編集だけを条件にして `useDeferredValue` → `useSuspenseQuery` に通す。理由と却下した案は「入力欄を URL の編集として持つ理由」にある。

| 対象       | 組み方                                                                                                                                                                                                                                   | 守らないと                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 世代       | `q` が変わった回数を「世代」として描画中に導く (`useState` + prop の変化で更新。[React docs「Adjusting some state when a prop changes」][])。編集は `{ generation, text }` で持ち、表示値は世代が一致するときだけ `text`、それ以外は `q` | `key={q}` でページを作り直すと確定 (Enter) のたびに入力欄が新しい要素になりフォーカスが body へ落ちる (2026-09-23 に実測)。effect で setState すると 1 描画ぶん古い値が見える                                       |
| 紐付け     | 編集を `q` の値ではなく世代で紐付ける                                                                                                                                                                                                    | 履歴が同じ値へ戻ったとき (abc → xyz を確定 → abc へ戻る)、値で照合すると確定済みの編集が復活する                                                                                                                    |
| debounce   | debounce するのは編集そのもの (`useDebouncedValue(edit)`)。debounce 済みの編集も世代が一致するときだけ使い、違えば URL の `q` を条件にする                                                                                               | 文字列を debounce すると、確定や戻るで URL が変わった後も debounce 済みの古い値が生き残り、URL でも入力でもない第 3 の条件を描く                                                                                    |
| deferred   | 条件は `useDeferredValue` を通してから `useSuspenseQuery` の key にする ([TanStack Query の `transition.test.tsx`][] の形)                                                                                                               | 無いと新しい key で Suspend した瞬間に Suspense が古い一覧を隠す ([React docs「useDeferredValue」][] の「Showing stale content while fresh content is loading」、「debounce と `useDeferredValue` を両方通す理由」) |
| 正規化     | 入力欄の編集 (draft と debounce 済み) は、URL / server function と同じ絞り込みの schema で正規化する (trim と上限)。正規化は入力の直後に 1 回で、下流はその値から導く                                                                    | 下流の複数箇所で呼ぶと、呼び忘れた経路が生の値で走る。`" abc"` と `"abc"` が別のキャッシュになる                                                                                                                    |
| ずれの表示 | 入力と表示中の条件がずれている間 (正規化後の入力値と deferred な条件が違う。debounce の待ちと取得中) は、一覧を `StaleContent` (`src/components/parts/stale-content.tsx`) で包み、`aria-busy` と半透明で残す                             | 古い一覧が新しい条件の結果に見える ([React docs「useDeferredValue」][] の `isStale` の形)。生の文字列で比べると、submit で入力欄を揃えた直後に、条件が同じまま印が出る                                              |
| submit     | submit では入力欄も正規化後の値に揃える (値が変わるときだけ setState)                                                                                                                                                                    | URL が同じ (同じ条件で Enter) だと作り直しも遷移も起きず、trim と切り詰めが見えない                                                                                                                                 |
| 楽観行     | 追加中の行は、条件によらず一覧の先頭に出す (行を組む純粋関数が保存中の行を先に並べる)                                                                                                                                                    | 追加中だけ条件で隠すと「追加したのに出ない」に見える。保存後の再取得で条件に合わなければ消える                                                                                                                      |

待ちの実値は route の `-lib/` の定数が持つ。テストは module の partial mock で広げるので、`: number` の注釈を付けて literal 型に固めない。

## explanation

### TanStack Table v9 の前提

ADR-0018 の Context が出典を持つ。組むときに効くのは次の 4 点である。

- data と columns の参照が変わると、row model と column model を作り直す。React Compiler があれば `useMemo` は要らないが、columns は module スコープに置き、data は query の参照をそのまま使う ([TanStack Table docs「React Compiler」][])
- query の結果は `data` に直接渡し、state に写さない。写すと、キャッシュに遅れる同期経路が増える (skill [`@tanstack/react-table` の `skills/with-tanstack-query/SKILL.md`][])
- cell に関数や状態を渡す経路は `table.options.meta` ([TanStack Table docs「Table and Column Meta」][])
- 楽観表示は Table ではなく Query 側の関心事である。Table は機構を持たない (ADR-0018)

### debounce と `useDeferredValue` を両方通す理由

debounce は取得の回数を減らし、`useDeferredValue` は Suspense の fallback を防ぐ。役割が違うので、片方では足りない。[React docs「useDeferredValue」][] も debounce と `useDeferredValue` を「You can also use these techniques together」と併用可とし、debounce の役割を「fire fewer network requests」に置く。

- `@tanstack/react-pacer` 0.23.0 の `useDebouncedValue` は `useState` の setter をそのまま、依存する `@tanstack/pacer` 0.22.0 の `Debouncer` (`setTimeout`) に渡し、`startTransition` を通さない (`react-pacer` の `dist/debouncer/useDebouncedState.js`、`pacer` の `dist/debouncer.js`。どちらにも `startTransition` の参照は無い)
- そのため debounce 後の値でそのまま `useSuspenseQuery` を呼ぶと、緊急更新の中で Suspend し、Suspense が古い一覧を `display: none` で隠す。Suspense モードで queryKey を変えるなら更新を Transition に包む ([TanStack Query docs「Suspense」][] の「wrap your updates that change the QueryKey into startTransition」)
- 打鍵が止まってから 1 回だけ取得し、その間は古い一覧を半透明で残すことを見るテストは、古い行を `toBeVisible` で見る。`toBeInTheDocument` では隠れた木も通り、この欠落を落とせない
- `@tanstack/react-pacer` は beta で API が変わりうる ([TanStack Pacer docs「Overview」][] の「TanStack Pacer is currently in beta and its API is still subject to change」)。使う API は `useDebouncedValue` だけに絞り、呼び出しは検索欄を組むページ本体の 1 箇所に閉じる

### 入力欄を URL の編集として持つ理由

絞り込み条件は URL が持つ (ADR-0019)。入力欄は URL とは別に打鍵中の値を持ち ([TanStack/router#3162][]。search param に束縛した入力欄でカーソルが末尾へ跳ぶ。局所 state を挟む回避策)、打鍵に追従して一覧を描き直す。示したいのは、ページのローディングを route loader での取得の待ち合わせと `useSuspenseQuery` と `pendingComponent` で行う形を崩さずに打鍵へ追従する形である。制約は次のとおり。

- Suspense モードで queryKey を変えると、更新を Transition に包まない限り fallback に置き換わる ([TanStack Query docs「Suspense」][])。打鍵のたびに skeleton へ落ちる一覧は作らない
- 打鍵ごとに server function を呼ばない
- URL の `q` が変わったら (確定、戻る / 進む、Link) 入力欄はその値に揃う。[React docs「Adjusting some state when a prop changes」][] はこの同期を「`key` で作り直す」か「描画中に計算する」で行い、effect で setState しない
- 同じ画面の要素を作り直さない (ADR-0027)

| 案                                                                              | 評価                                                                                                                                                         | 採否     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 編集を世代で紐付け、編集ごと debounce → `useDeferredValue` → `useSuspenseQuery` | URL の変化で編集も debounce 済みの値も無効になり、要素を作り直さない                                                                                         | **採用** |
| 編集を `{ base: q, text }` で持ち、`base === q` で有効性を見る                  | 履歴が同じ値へ戻ると確定済みの編集が復活する                                                                                                                 | 却下     |
| 文字列を debounce し「入力欄が URL と同じなら待たない」特例を置く               | 確定や戻るの後に debounce 済みの古い文字列が第 3 の条件を描く。特例はその一部しか隠さない                                                                    | 却下     |
| `useQuery` + `placeholderData: keepPreviousData`                                | 古いデータを残せるが、`useSuspenseQuery` + `pendingComponent` の形から外れ、ページに `isPending` 分岐が戻る                                                  | 却下     |
| debounce を `useEffect` + `setTimeout` で手組みする                             | effect 内の setState を lint が止める (`react/set-state-in-effect`)。Pacer ([TanStack Pacer docs「useDebouncedValue」][]) と `use-debounce` が公式の形を持つ | 却下     |
| `use-debounce`                                                                  | 安定しているが、TanStack の同梱 (`@tanstack/react-pacer`) で足りる                                                                                           | 却下     |

`key={q}` でページを作り直す案は ADR-0027 が却下している。

### 入力欄と URL の関係で起きること

- 確定と戻るの直後は、編集の世代が URL と合わない。debounce の待ちを経ずに、URL の条件 (loader が取得したキャッシュ) を描く
- ページは URL の変化をまたいで生き続ける (ADR-0027)。そのため、結果の通知の記憶 (`useRef`) をページに置ける
- 打鍵中の再描画は少ない。`useDebouncedValue` は selector を渡さない限り store の購読で再描画せず ([TanStack Pacer docs「useDebouncedValue」][] の「State Management and Selector」)、React Compiler の出力で `v.parse` は入力値ごとに memo され、`DataTable` は打鍵で作り直されない (2026-09-23 に oxc-transform-react で確認)
- 検索欄を持つ route を、上限を超える `q` を手で書いた URL で開くと、URL バーも切り詰め後の値に書き換わる。Router が `validateSearch` の出力で location を組み直す (2026-09-23 に dev server で実測)

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[TanStack Table docs「FlexRender」]: https://tanstack.com/table/latest/docs/framework/react/guide/flex-render
[shadcn docs「Data Table」]: https://ui.shadcn.com/docs/components/base/data-table
[`@tanstack/table-core` の `skills/typescript/SKILL.md`]: https://github.com/TanStack/table/blob/@tanstack/table-core@9.2.4/packages/table-core/skills/typescript/SKILL.md
[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/framework/react/guide/data-loading
[React docs「Adjusting some state when a prop changes」]: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
[TanStack Query の `transition.test.tsx`]: https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/transition.test.tsx
[React docs「useDeferredValue」]: https://react.dev/reference/react/useDeferredValue
[TanStack Table docs「React Compiler」]: https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler
[`@tanstack/react-table` の `skills/with-tanstack-query/SKILL.md`]: https://github.com/TanStack/table/blob/@tanstack/react-table@9.2.4/packages/react-table/skills/with-tanstack-query/SKILL.md
[TanStack Table docs「Table and Column Meta」]: https://tanstack.com/table/latest/docs/guide/table-and-column-meta
[TanStack Query docs「Suspense」]: https://tanstack.com/query/latest/docs/framework/react/guides/suspense
[TanStack Pacer docs「Overview」]: https://tanstack.com/pacer/latest/docs/overview
[TanStack/router#3162]: https://github.com/TanStack/router/issues/3162
[TanStack Pacer docs「useDebouncedValue」]: https://tanstack.com/pacer/latest/docs/framework/react/reference/functions/useDebouncedValue
