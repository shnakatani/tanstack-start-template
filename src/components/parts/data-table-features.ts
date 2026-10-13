import type { CellContext, RowData } from "@tanstack/react-table";
import {
  columnSizingFeature,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * 一覧テーブル共通の features。増やし方は `docs/guides/lists-and-search.md`「一覧テーブルを組む」の features 行。
 * cell の見た目は列の `cell` 部品の中で書き、td へ class を写す meta は持たない。td の className は
 * 動的になり `require-static-classes` が落とす (ADR-0022)。
 * `expandedRowModel` は、詳細の行だけを開く表 (subRows が無い) では行の並びを変えないが、TanStack Table の
 * guide と example がどちらも `rowExpandingFeature` と対で登録するので、同じ形にする (ADR-0043)
 */
export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** cell 部品が受ける props。列定義の `cell` に部品の参照を渡すと `FlexRender` がこれを渡す */
export type DataTableCellContext<TData extends RowData> = CellContext<DataTableFeatures, TData>;
