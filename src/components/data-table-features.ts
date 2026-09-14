import { metaHelper, tableFeatures } from "@tanstack/react-table";

/** 列定義が持つ描画の指定。`DataTable` が td に写す。 */
type DataTableColumnMeta = { cellClassName?: string };

/** 一覧テーブル共通の features。増やし方は ADR-0019「features」。 */
export const dataTableFeatures = tableFeatures({ columnMeta: metaHelper<DataTableColumnMeta>() });

export type DataTableFeatures = typeof dataTableFeatures;
