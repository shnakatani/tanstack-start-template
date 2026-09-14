import { metaHelper, tableFeatures } from "@tanstack/react-table";

/**
 * 列定義が持つ描画の指定。セルの className は列定義側に置き、`DataTable` は写すだけにする
 * (`declare module` で全体に merge せず、table 単位で型付けする。ADR-0019)
 */
type DataTableColumnMeta = { cellClassName?: string };

/**
 * アプリの一覧テーブルが共有する features (shadcn Data Table の `data-table-features.ts` と同じ役割)。
 * 使う機能だけ登録する。sorting 等を足すときは対応する feature と row model をここに足し、
 * 楽観行の出入りで data が変わるたびにページが戻らないよう `autoResetPageIndex` を見直す (ADR-0019)
 */
export const dataTableFeatures = tableFeatures({ columnMeta: metaHelper<DataTableColumnMeta>() });

export type DataTableFeatures = typeof dataTableFeatures;
