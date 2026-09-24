import type { CellContext, RowData } from "@tanstack/react-table";
import { metaHelper, tableFeatures } from "@tanstack/react-table";

/** 列定義が持つ描画の指定。`DataTable` が td に写す。 */
type DataTableColumnMeta = { cellClassName?: string };

/** 一覧テーブル共通の features。増やし方は `docs/guides/lists-and-search.md`「一覧テーブルを組む」の features 行。 */
export const dataTableFeatures = tableFeatures({ columnMeta: metaHelper<DataTableColumnMeta>() });

export type DataTableFeatures = typeof dataTableFeatures;

/** cell 部品が受ける props。列定義の `cell` に部品の参照を渡すと `FlexRender` がこれを渡す */
export type DataTableCellContext<TData extends RowData> = CellContext<DataTableFeatures, TData>;
