import type { ColumnDef_ColumnSizing, IdIdentifier, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "./data-table-features";

/** 列の見出しと幅 (px)。`DataTable` と読み込み中の `TableSkeleton` が、同じ値を列見出しの幅に当てる */
export interface DataTableColumnBase {
  header: string;
  size: number;
}

/**
 * 列の定数 (列の id をキー、見出しと幅を値にした object) から、列定義へ渡す `{ id, header, size }` を作る関数を返す。
 * id の typo は型が止め、見出しと幅は定数から引くので写さない (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)。
 * 戻り値は注釈で広げず、TanStack Table の形だけを `satisfies` で検査する
 */
export function columnBaseFrom<
  const TColumns extends Readonly<Record<keyof TColumns, DataTableColumnBase>>,
>(columns: TColumns) {
  return <TId extends keyof TColumns & string>(id: TId) =>
    ({
      id,
      header: columns[id].header,
      size: columns[id].size,
    }) satisfies IdIdentifier<DataTableFeatures, RowData> & ColumnDef_ColumnSizing;
}
