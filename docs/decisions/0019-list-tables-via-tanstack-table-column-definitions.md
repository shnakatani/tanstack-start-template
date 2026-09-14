# ADR-0019: 一覧テーブルは TanStack Table v9 の列定義で組み、描画は registry の Table に残す

- Status: Proposed
- Date: 2026-09-14
- 関連: ADR-0006 (registry コードは触らない)、ADR-0009 (手動メモ化の増減)、ADR-0012 (配置の原則)、ADR-0014 / ADR-0016 (楽観表示は mutation の pending から取る)

## Context

`src/routes/notes/index.tsx` の一覧は、列見出しの配列 (`NOTE_TABLE_HEADERS`) と各行の `TableCell` を別々に書いていた。見出しとセルの対応を型が結ばないので、列を足すときに片方だけ書き忘れても検査で落ちない。保存中の楽観行 (ADR-0016) も確定行とは別に手書きの `TableRow` で描いており、同じ列構造を 2 箇所で維持していた。

| 出典                                                                                 | 内容                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn「Data Table」(base registry)                                                  | `@tanstack/react-table` v9 を入れ、`createColumnHelper` で列を定義し、`useTable` + `FlexRender` で registry の `Table` に描く。`DataTable` は registry 部品ではなく app にコピーし、複数箇所で使うようになったら `components/ui/data-table.tsx` へ切り出す |
| TanStack Table v9 (9.2.4、2026-08-28 公開)                                           | `useReactTable` ではなく `tableFeatures({...})` + `useTable({ features, columns, data })`。row model は feature として明示登録する。`FlexRender` は table インスタンスのメソッドか standalone                                                              |
| 同梱の agent skill (`@tanstack/react-table` / `@tanstack/table-core`)                | `getting-started`、`core`、`table-features`、`typescript`、`with-tanstack-query`、`devtools` 等が `node_modules/<package>/skills/` に入る。`vp dlx @tanstack/intent@latest list` で見える                                                                  |
| docs「Helpers」「TypeScript」skill                                                   | `createColumnHelper<typeof features, TData>()` と `helper.columns([...])` が accessor ごとの値の型を保つ。`ColumnDef[]` の注釈で広げない。meta は `metaHelper` で table 単位に型付けし、`declare module` で全体に merge しない                             |
| docs「React Compiler」                                                               | compiler があれば `useMemo` は不要。data と columns の参照が変わると row / column model を作り直すので、columns は module スコープに置き、data は query の参照をそのまま使う                                                                               |
| docs「Table and Column Meta」                                                        | cell に関数や状態を渡す経路は `table.options.meta` (editable の `updateData` が例)                                                                                                                                                                         |
| skill `with-tanstack-query`                                                          | query の結果を `data` に直接渡す。query の行を state に写すのは誤り (キャッシュに遅れる同期経路が増える)                                                                                                                                                   |
| TanStack/table Discussion #5670 (2024-07)                                            | 「削除後に UI が更新されない」への回答は「React Query の optimistic updates の例に従え」。楽観表示は Table ではなく Query 側の関心事                                                                                                                       |
| docs (auto reset)                                                                    | v9 は sorting を既定で保持し、`autoResetPageIndex` は data が変わるとページを戻す (無効化可)。選択状態は行が消えても自動では掃除されない                                                                                                                   |
| TanStack DB                                                                          | Query の collection に楽観状態を overlay し、失敗で自動 rollback、`useLiveQuery` で読む層。楽観的更新を前提にした TanStack 側の答え                                                                                                                        |
| vitest browser の locator (`@vitest/browser` 4.1.11) / WAI「Tables with one header」 | `<th>` は `scope="col"` があるときだけ `columnheader` に解決される (暗黙の role は見ない)。WAI のチュートリアルも見出しセルに `scope` を勧める                                                                                                             |

## Decision

**一覧テーブルは TanStack Table v9 の列定義 (`createColumnHelper`) を SSOT にし、shadcn「Data Table」と同じ構成の `DataTable` 部品 (`src/components/data-table.tsx`) が registry の `Table` に `FlexRender` で描く。楽観表示の設計は ADR-0016 のままで、data 配列を組み立てる側に閉じる。**

| 対象             | 形                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DataTable` 部品 | `src/components/data-table.tsx` (registry ではない自作の共有部品の置き場)。`columns` / `data` / `tableKey` / `getRowId` / `rowProps` / `emptyText` を受け、`useTable` と `FlexRender`、見出しの `scope="col"`、devtools 登録、空行を持つ。features は `src/components/data-table-features.ts` (shadcn の `data-table-features.ts` と同じ役割)                                                          |
| 列定義の置き場   | その画面だけの列は `routes/<path>/-lib/<画面>-columns.tsx`。列定義は設定であって部品ではないので、`-components/` (部品) と分けた `-lib/` (route-local の非コンポーネント: handle、列定義、純粋関数) に置く。cell が描く部品 (削除トリガー等) は `-components/` に切り出す。ドメインを跨いで使う列は `src/features/<domain>/`                                                                           |
| 型               | features は `data-table-features.ts` に 1 つ置き、`createColumnHelper<DataTableFeatures, Row>()` と `helper.columns([...])` で定義する。`ColumnDef[]` の注釈で値の型を広げない。cell の className は `columnMeta` (`metaHelper`) で列定義が持つ                                                                                                                                                        |
| 行の型           | 確定行と保存中の行の union (`src/features/notes/note-rows.ts` の `NoteRow`: `{ kind: "saved"; note; isDeleting } \| { kind: "creating" } & CreatingRow`)。cell が `kind` で分岐するので、楽観行も同じ列定義で描ける                                                                                                                                                                                    |
| data の組み立て  | ページが `toNoteRows({ notes, creatingRows, deletingIds })` (純粋関数、単体テスト付き) で組んで `DataTable` に渡す。派生値は hook より後ろで作る (hook の間に挟むと React Compiler が scope を切れず毎 render 新しい参照になる)。`useMemo` は書かない (ADR-0009)。`getRowId` で `creating-<submittedAt>` / `saved-<id>` を付け、React の key にも使う                                                  |
| 描画             | `DataTable` が `table.getHeaderGroups()` / `row.getAllCells()` + `<table.FlexRender>` で描く。registry の `Table*` は触らない (ADR-0006)。行の `aria-busy` と半透明はページが `rowProps` で `row.original` から決める。空状態の案内はページの `Empty` 部品が持ち、`DataTable` の空行は単体で使うときの既定                                                                                             |
| features         | 使う機能だけ登録する (今は `columnMeta` のみ)。sorting / pagination を足すときは対応する feature と row model を足し、楽観行の出入りで data が変わるたびにページが戻らないよう `autoResetPageIndex` を見直す                                                                                                                                                                                           |
| cell への関数    | module 定数は import で足りる。削除確認の handle は `-lib/note-delete-dialog-handle.ts` が持ち、trigger の部品 (`-components/note-delete-trigger.tsx`) と Root を描くページの両方がそこに依存する (依存の向きは列定義 → handle で、逆ではない)。Root の実体が共有部品 (`DeleteConfirmDialog`) なら wrapper を挟まない。cell が画面の callback を要するようになったら `tableMeta` (`metaHelper`) で渡す |
| devtools         | `DataTable` が `tableKey` を `useTable` の `key` に渡し、`useTanStackTableDevtools(table)` を直後に呼ぶ。`RootComponent` の `TanStackDevtools` に `tableDevtoolsPlugin()` を並べる (Query / Router と同列)                                                                                                                                                                                             |
| skill            | 列定義や table の設定を触るときは `@tanstack/react-table#getting-started`、`@tanstack/table-core#core` / `#table-features` / `#typescript` を load する。v8 の `useReactTable` の形を書かない                                                                                                                                                                                                          |
| 楽観的更新       | Table は機構を持たない。variables 方式 (ADR-0016) は data の組み立てで、キャッシュ書き換え方式はキャッシュ配列で、どちらも Table 側は変わらない。楽観的更新を扱う画面が増えたら TanStack DB への寄せ替えを ADR-0016 の再評価で扱う                                                                                                                                                                     |

### 検討した選択肢

| 案                                             | 評価                                                                                                                                                                                                                         | 採否     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| TanStack Table v9 の列定義 + registry の Table | 公式 (shadcn Data Table) と同じ形。見出しとセルが 1 つの定義に載る。sorting / filtering を足すときも feature の登録で済む。同梱 skill が実装の規範を持つ                                                                     | **採用** |
| 自前の `{ header, cell }` 配列                 | 型では結べるが、並び替えや表示切替を足すたびに自作が増える。公式の先行例が無い                                                                                                                                               | 却下     |
| 現状維持 (見出し配列とセルを別々に書く)        | 列を足すときに片方だけ書き忘れても検査で落ちない。楽観行の列構造が 2 箇所                                                                                                                                                    | 却下     |
| shadcn の `DataTable` 部品を持つ               | 描画の骨組み (`FlexRender`、`scope="col"`、devtools、空行) が 1 箇所に集まり、ページは列定義と data を渡すだけになる。置き場は registry ではない自作部品の `src/components/` (ADR-0006 で `components/ui/` は registry 専用) | **採用** |
| `createTableHook` で app 共通の factory を作る | 同梱 skill `create-table-hook` が「table が 1 つのうちは factory を作らず `useTable` 単体」と明言。2 つ目の table で共通の規約が要るようになったら再評価                                                                     | 再評価   |
| TanStack DB で楽観状態ごと置き換える           | 楽観的更新を扱う画面が 1 つのうちは ADR-0016 の variables 方式で足りる。Query の collection 化は画面横断の変更になる                                                                                                         | 再評価   |

## Consequences

- 依存に `@tanstack/react-table` と `@tanstack/react-table-devtools` が入る (ADR-0005 の待機 3 日は経過)。`@tanstack/table-core` と `@tanstack/react-store` が同梱で入る
- `TableSkeleton` の列数は列定義の `length` から採る。列を足すと skeleton も追随する
- `.claude/rules/directory-structure.md` が列定義の置き場と、route-local の非コンポーネントを置く `-lib/` を持つ。`.claude/rules/implementation.md` が見出しセルの `scope="col"` を持つ
- 再評価条件: 2 つ目の一覧画面が出たとき (`createTableHook` の factory)、sorting / pagination を足すとき (`autoResetPageIndex`)、楽観的更新を扱う画面が増えたとき (TanStack DB)

## 出典

- shadcn「Data Table」(base): https://ui.shadcn.com/docs/components/base/data-table
- TanStack Table「Migrating to V9」: https://tanstack.com/table/latest/docs/framework/react/guide/migrating
- TanStack Table「Helpers」: https://tanstack.com/table/latest/docs/guide/helpers
- TanStack Table「React Compiler」: https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler
- TanStack Table「Table and Column Meta」: https://tanstack.com/table/latest/docs/guide/table-and-column-meta
- TanStack Table「Agent Skills」: https://tanstack.com/table/latest/docs/agent-skills
- TanStack/table Discussion #5670: https://github.com/TanStack/table/discussions/5670
- TanStack DB「Overview」: https://tanstack.com/db/latest/docs/overview
- WAI「Tables with one header」: https://www.w3.org/WAI/tutorials/tables/one-header/
