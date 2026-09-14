import { type Row, type RowData, type TableOptions, useTable } from "@tanstack/react-table";
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

import { type DataTableFeatures, dataTableFeatures } from "./data-table-features";

/** 転送する option の型は `useTable` の options から導出する (`.claude/rules/typing.md`「ラッパー部品の転送 prop 型」) */
type TableOptionsOf<TData extends RowData> = TableOptions<DataTableFeatures, TData>;

interface DataTableProps<TData extends RowData> {
  /** devtools に登録する識別子。画面ごとに一意にする (`useTable` の `key`) */
  tableKey: string;
  columns: TableOptionsOf<TData>["columns"];
  data: TData[];
  /** 行の識別子。省略すると index になり、行の出入りで React の key がずれる */
  getRowId?: TableOptionsOf<TData>["getRowId"];
  /** 行ごとに足す属性。busy 表現 (`aria-busy` と半透明) など、行データから決まるもの */
  rowProps?: (
    row: Row<DataTableFeatures, TData>,
  ) => Pick<ComponentProps<typeof TableRow>, "aria-busy" | "className">;
  /** data が空のときに 1 行で出す案内。画面が `Empty` 部品を別に持つなら描画側で分岐する */
  emptyText?: string;
}

/**
 * 列定義 (TanStack Table v9) を registry の `Table` 部品に描く (ADR-0019)。
 * shadcn「Data Table」の `DataTable` と同じ構成で、features は `data-table-features.ts` が持つ。
 * 列見出しには `scope="col"` を付ける。暗黙の role は支援技術とテストの locator で
 * columnheader に解決されない (WAI「Tables with one header」)。
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
          rows.map((row) => (
            <TableRow key={row.id} {...rowProps?.(row)}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
