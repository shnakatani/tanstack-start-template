# 一覧・絞り込み・検索

一覧テーブル、URL の search param による絞り込み、打鍵に追従する検索欄を組むときの手順と、その形にしている理由を持つ。実例は `/notes` (`src/routes/notes/`) にある。

| 決定                                                                                                        | ADR      |
| ----------------------------------------------------------------------------------------------------------- | -------- |
| 一覧テーブルは TanStack Table v9 の列定義で組み、描画は registry の Table に残す                            | ADR-0021 |
| 一覧の絞り込み条件は URL の search param が持ち、`loaderDeps` で loader に渡す                              | ADR-0022 |
| 検索の入力欄は URL の `q` に対する編集として持ち、debounce → `useDeferredValue` → `useSuspenseQuery` で描く | ADR-0023 |

## how-to

### 一覧テーブルを組む

ページは `DataTable` (`src/components/parts/data-table.tsx`) に列定義と data を渡す。列定義や table の設定を触るときは、同梱の skill `@tanstack/react-table#getting-started` と `@tanstack/table-core#core` / `#table-features` / `#typescript` を load する。v8 の `useReactTable` の形は書かない。

| 対象            | 組み方                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列定義の置き場  | その画面だけの列は `routes/<path>/-lib/<画面>-columns.ts` (JSX を持たない設定)。描画を持つ列は、`cell` に `-components/` の部品の参照を渡す (`FlexRender` が cell の context を props にして描く。TanStack Table「Flex Render」)。ドメインをまたいで使う列は `src/features/<domain>/`                                                                                                                                                                                                                         |
| 型              | features は `src/components/parts/data-table-features.ts` に 1 つ置き、`createColumnHelper<DataTableFeatures, Row>()` と `helper.columns([...])` で定義する。`ColumnDef[]` の注釈で値の型を広げない。cell の className は `columnMeta` (`metaHelper`) で列定義が持つ                                                                                                                                                                                                                                          |
| 行の型          | 確定行と保存中の行の union にする (`src/routes/notes/-lib/note-rows.ts` の `NoteRow`)。cell が `kind` で分岐するので、楽観行も同じ列定義で描ける。行モデルは画面の描画の形なので route の `-lib/` に置き、mutation の variables を絞る parser は `src/features/<domain>/` に置く                                                                                                                                                                                                                              |
| data の組み立て | ページが純粋関数 (`toNoteRows`、単体テスト付き) で組んで `DataTable` に渡す。派生値は hook より後ろで作る。hook の間に挟むと React Compiler が scope を切れず、毎 render 新しい参照になる。`useMemo` は書かない (ADR-0016)。`getRowId` で `creating-<submittedAt>` / `saved-<id>` を付け、React の key にも使う                                                                                                                                                                                               |
| 描画            | `DataTable` が `table.getHeaderGroups()` / `row.getAllCells()` と `<table.FlexRender>` で描く。registry の `Table*` は触らない (ADR-0024)。行の `aria-busy` はページが `rowProps` で `row.original` から決め、半透明は `DataTable` が `aria-busy` から当てる。`rowProps` に `className` を通さない。コールバックの中の class は `no-restyle` が追えず、`<TableRow>` へ直接書けば落ちる class が診断なしで通る (ADR-0028)。空状態の案内はページの `Empty` 部品が持ち、`DataTable` の空行は単体で使うときの既定 |
| features        | 使う機能だけを登録する。sorting / pagination を足すときは、対応する feature と row model を足し、楽観行の出入りで data が変わるたびにページが戻らないよう `autoResetPageIndex` を見直す                                                                                                                                                                                                                                                                                                                       |
| cell への関数   | module 定数は import で足りる。削除確認の handle は `-lib/note-delete-dialog-handle.ts` が持ち、trigger を描く cell 部品 (`-components/note-cells.tsx`) と Root を描くページの両方がそこに依存する (列定義 → cell 部品 → handle の向き)。Root の実体が共有部品 (`DeleteConfirmDialog`) なら wrapper を挟まない。cell が画面の callback を要するようになったら `tableMeta` (`metaHelper`) で渡す                                                                                                               |
| devtools        | `DataTable` が `tableKey` を `useTable` の `key` に渡し、`useTanStackTableDevtools(table)` を直後に呼ぶ。`RootComponent` の `TanStackDevtools` に `tableDevtoolsPlugin()` を並べる                                                                                                                                                                                                                                                                                                                            |
| loading         | `TableSkeleton` の列数は列定義の `length` から採る。列を足すと skeleton も追随する                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 絞り込み条件を URL に置く

ADR-0022 の決定 (search param `q`、`loaderDeps`、submit で replace) に沿って、次のように組む。実例は `src/routes/notes/index.tsx` と `src/features/notes/`。

| 対象      | 組み方                                                                                                                                                                                                                                 | 守らないと                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema    | 絞り込み条件の schema は 1 つ (`src/features/notes/schema.ts` の `noteListFilterSchema`) にし、server function の `.validator` と route の `validateSearch` が同じものを使う。valibot 1.x は Standard Schema なので adapter は要らない | URL では通るのにサーバで落ちる (またはその逆の) 組み合わせが生まれる                                                                                                                                           |
| 既定値    | `search.middlewares` の `stripSearchParams(v.getDefaults(noteListFilterSchema))` で URL から落とす。既定は schema から導く                                                                                                             | `/notes` と `/notes?q=` が別の場所になり、履歴と link の比較が揺れる。既定を写すと schema と別々に動く                                                                                                         |
| loader    | loader が読む search は `loaderDeps: ({ search }) => ({ q: search.q })` で宣言し、`loader` は options に直接書いて `notesQueryOptions(deps)` を温める。検証は router 経由 (ADR-0044)                                                   | deps に無い search は loader に届かず、preload が別条件のデータを表示側に残す。loader を関数に切り出すと、引数の型を手で書くことになる (`typeof Route` は循環し、`LoaderFnContext` は `AnyRoute` 経由で `any`) |
| query key | `notesQueryOptions(filter)` の key は `[...NOTES_QUERY_KEY, filter]` にする。mutation の invalidate は `NOTES_QUERY_KEY` の前方一致のまま                                                                                              | 条件ごとに key を分けないと、条件の違う一覧が同じキャッシュを上書きする。invalidate を条件付きの key にすると、他の条件の一覧が古いまま残る                                                                    |

### 検索の入力欄を組む

ADR-0023 の決定 (編集を世代で紐付け、編集ごと debounce し、`useDeferredValue` を通す) に沿って、次のように組む。実例は `src/routes/notes/-components/notes-page.tsx` と `note-search-field.tsx`。

| 対象       | 組み方                                                                                                                                                                                                       | 守らないと                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 正規化     | 入力欄の編集 (draft と debounce 済み) は、URL / server function と同じ `noteListFilterSchema` で正規化する (trim と上限)。正規化は入力の直後に 1 回で、下流はその値から導く                                  | 下流の複数箇所で呼ぶと、呼び忘れた経路が生の値で走る。`" abc"` と `"abc"` が別のキャッシュになる                |
| ずれの表示 | 入力と表示中の条件がずれている間 (正規化後の入力値と deferred な条件が違う。debounce の待ちと取得中) は、一覧を `StaleContent` (`src/components/parts/stale-content.tsx`) で包み、`aria-busy` と半透明で残す | 古い一覧が新しい条件の結果に見える。生の文字列で比べると、submit で入力欄を揃えた直後に、条件が同じまま印が出る |
| submit     | submit では入力欄も正規化後の値に揃える (値が変わるときだけ setState)                                                                                                                                        | URL が同じ (同じ条件で Enter) だと作り直しも遷移も起きず、trim と切り詰めが見えない                             |
| 楽観行     | 追加中の行は、条件によらず一覧の先頭に出す (`toNoteRows` の合成順のまま)                                                                                                                                     | 追加中だけ条件で隠すと「追加したのに出ない」に見える。保存後の再取得で条件に合わなければ消える                  |

待ちの実値は `src/routes/notes/-lib/note-search.ts` の `NOTE_SEARCH_DEBOUNCE_MS` が持つ。

## explanation

### TanStack Table v9 の前提

ADR-0021 の Context が出典を持つ。組むときに効くのは次の 4 点である。

- data と columns の参照が変わると、row model と column model を作り直す。React Compiler があれば `useMemo` は要らないが、columns は module スコープに置き、data は query の参照をそのまま使う (docs「React Compiler」)
- query の結果は `data` に直接渡し、state に写さない。写すと、キャッシュに遅れる同期経路が増える (skill `with-tanstack-query`)
- cell に関数や状態を渡す経路は `table.options.meta` (docs「Table and Column Meta」)
- 楽観表示は Table ではなく Query 側の関心事である。Table は機構を持たない (ADR-0021)

### debounce と `useDeferredValue` を両方通す理由

debounce は取得の回数を減らし、`useDeferredValue` は Suspense の fallback を防ぐ。役割が違うので、片方では足りない。
`useDebouncedValue` は Transition を通さずに state を更新するので、debounce 後の値でそのまま `useSuspenseQuery` を呼ぶと、緊急更新の中で Suspend して古い一覧が隠れる。詳細と出典は ADR-0023「`useDeferredValue` を外せない理由」が持つ。

### 入力欄と URL の関係で起きること

- 確定と戻るの直後は、編集の世代が URL と合わない。debounce の待ちを経ずに、URL の条件 (loader が温めたキャッシュ) を描く
- ページは URL の変化をまたいで生き続ける (`key={q}` で作り直さない)。そのため、結果の通知の記憶 (`useRef`) をページに置ける (ADR-0033)
- 打鍵中の再描画は少ない。`useDebouncedValue` は selector を渡さない限り store の購読で再描画せず、React Compiler の出力で `v.parse` は入力値ごとに memo され、`DataTable` は打鍵で作り直されない (2026-09-23 に oxc-transform-react で確認)
- 手で書いた `/notes?q=<101 文字>` を開くと、URL バーも切り詰め後の 100 文字に書き換わる。Router が `validateSearch` の出力で location を組み直す (2026-09-23 に dev server で実測)
