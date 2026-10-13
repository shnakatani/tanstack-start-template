import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DataTableColumnBase } from "./data-table-columns";

/**
 * 一覧テーブルのローディング表示。
 * 実テーブルの列見出しと行構造を近似し、ロード完了時のレイアウトシフトを抑える。
 *
 * 支援技術には、列見出しを持つ table と「読み込み中」の 1 行だけを見せ、skeleton の行は `aria-hidden` で隠す
 * (`docs/guides/accessibility.md`「読み込み中の表示の見せ方を選んだ理由」)。
 * `columns` には本体の列定義と同じ見出しと幅を渡す。幅が同じなので、本体へ置き換わっても列が動かない。
 * 見出しは重複させない。列の key に使う。`caption` は本体の `DataTable` と同じ値を渡す。
 */
export function TableSkeleton({
  caption,
  columns,
  rows = 3,
}: {
  caption: string;
  columns: readonly DataTableColumnBase[];
  rows?: number;
}) {
  const rowKeys = Array.from({ length: rows }, (_, i) => i);

  return (
    <Table className="table-fixed">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {columns.map(({ header, size }) => (
            // 実テーブルと同じく scope="col" (列見出しとして数えられる)
            <TableHead key={header} scope="col" style={{ width: size }}>
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* 支援技術にだけ読ませる行。registry の TableRow / TableCell は下線と余白を持ち込むので素の要素で置く */}
        <tr>
          <td colSpan={columns.length}>
            <span className="sr-only">読み込み中</span>
          </td>
        </tr>
        {rowKeys.map((row) => (
          <TableRow key={row} aria-hidden>
            {columns.map(({ header }) => (
              <TableCell key={header}>
                <Skeleton className="h-8 w-full max-w-48" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
