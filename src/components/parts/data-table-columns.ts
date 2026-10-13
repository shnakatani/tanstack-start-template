import type { ColumnDef_ColumnSizing, IdIdentifier, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "./data-table-features";

/**
 * 列の見出しと幅。幅は既定の文字サイズのときの px で持つ。`DataTable` と読み込み中の `TableSkeleton` が、
 * `columnWidthFrom` で rem に換算して列見出しに当てる
 */
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

/** 1rem は root の文字サイズ (CSS Values 4 の `rem`) で、ブラウザの既定は 16px (MDN「font-size」の Ems) */
const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/**
 * 列の `size` を、列見出しの `style` の width に当てる rem の値にする。文字だけを拡大しても、列が文字と
 * 一緒に広がる (ADR-0042)。TanStack Table の size はただの数値で、DOM への当て方は描画側が決める
 */
export function columnWidthFrom(size: number): string {
  return `${size / DEFAULT_ROOT_FONT_SIZE_PX}rem`;
}
