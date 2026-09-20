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
 * busy 行の半透明。`opacity-50` は本文テキストのコントラストを 3.82:1 まで落として
 * WCAG 1.4.3 の 4.5:1 を割る (ADR-0016)
 */
const BUSY_ROW_CLASS = "opacity-60";

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
            const attributes = rowProps?.(row);
            return (
              <TableRow
                key={row.id}
                {...attributes}
                className={attributes?.["aria-busy"] ? BUSY_ROW_CLASS : undefined}
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
