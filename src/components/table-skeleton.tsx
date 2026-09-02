import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * 一覧テーブルのローディング表示。
 * 実テーブルの行構造を粗く近似し、ロード完了時のレイアウトシフトを抑える。
 */
export function TableSkeleton({ columns, rows = 3 }: { columns: number; rows?: number }) {
  const columnKeys = Array.from({ length: columns }, (_, i) => i);
  const rowKeys = Array.from({ length: rows }, (_, i) => i);

  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 実テーブルの行構造を近似してレイアウトシフトを抑えるのが目的で、output に差し替えるとその構造自体が失われる
    <Table role="status" aria-label="読み込み中" aria-busy="true">
      <TableHeader>
        <TableRow>
          {columnKeys.map((col) => (
            <TableHead key={col}>
              <Skeleton className="h-4 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rowKeys.map((row) => (
          <TableRow key={row}>
            {columnKeys.map((col) => (
              <TableCell key={col}>
                <Skeleton className="h-8 w-full max-w-48" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
