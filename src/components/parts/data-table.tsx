import type { Row, RowData, TableOptions } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useTanStackTableDevtools } from "@tanstack/react-table-devtools";
import type { ComponentProps } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { BUSY_OPACITY_CLASS } from "./busy-opacity";
import type { DataTableFeatures } from "./data-table-features";
import { dataTableFeatures } from "./data-table-features";

/** 転送する option の型は `useTable` の options から導出する (`.claude/rules/typing.md`「ラッパー部品の転送 prop 型」) */
interface DataTableProps<TData extends RowData> extends Pick<
  TableOptions<DataTableFeatures, TData>,
  "columns" | "data" | "getRowId"
> {
  /** devtools に登録する識別子。画面ごとに一意にする (`useTable` の `key`) */
  tableKey: string;
  /**
   * 行ごとに足す属性。行データから決まるものを返す。
   *
   * `className` は受けない。返した class は `rowProps` のコールバックの中にあって
   * `no-restyle` が追えず、`<TableRow>` へ直接書けば落ちる class が無診断で通る。
   * 外見は部品が持つ (ADR-0021)。半透明は `aria-busy` から下で当てる。
   */
  rowProps?: (
    row: Row<DataTableFeatures, TData>,
  ) => Pick<ComponentProps<typeof TableRow>, "aria-busy">;
  /** data が空のときに 1 行で出す案内。画面が `Empty` 部品を別に持つなら描画側で分岐する */
  emptyText?: string;
}

/**
 * 列定義 (TanStack Table v9) を registry の `Table` 部品に描く共有部品 (ADR-0019)。
 * 列見出しの `scope="col"` は `.claude/rules/implementation.md`「テーブルの列見出し」。
 */
export function DataTable<TData extends RowData>({
  tableKey,
  columns,
  data,
  getRowId,
  rowProps,
  emptyText = "データがありません",
}: DataTableProps<TData>) {
  const table = useTable({ key: tableKey, features: dataTableFeatures, columns, data, getRowId });
  useTanStackTableDevtools(table);
  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} scope="col">
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => {
            // 受け取った値から aria-busy だけを取り出して渡す。spread にすると、返り値の型に
            // 無い className がリテラルでない経路 (const props = {...}; () => props) で載って
            // しまい、JSX の後勝ちで静かに落ちる
            const busy = rowProps?.(row)["aria-busy"];
            return (
              <TableRow
                key={row.id}
                aria-busy={busy}
                // busy 行の半透明は Tailwind の aria-busy variant (`[aria-busy="true"]`) で
                // 当てる。aria-busy の型は Booleanish で文字列 "false" も来るが、属性セレクタは
                // "true" にしか一致しないので JS で真偽を判定しない。値の根拠は busy-opacity.ts
                className={BUSY_OPACITY_CLASS}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
