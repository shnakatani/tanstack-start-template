import type { IdIdentifier, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "./data-table-features";

/**
 * 列見出しの定数 (列の id をキー、見出しを値にした object) から、列定義へ渡す `{ id, header }` を作る関数を返す。
 * id の typo は型が止め、見出しは定数から引くので写さない (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)。
 * 戻り値は注釈で広げず、TanStack Table の形だけを `satisfies` で検査する
 */
export function columnBaseFrom<const THeaders extends Readonly<Record<keyof THeaders, string>>>(
  headers: THeaders,
) {
  return <TId extends keyof THeaders & string>(id: TId) =>
    ({ id, header: headers[id] }) satisfies IdIdentifier<DataTableFeatures, RowData>;
}
