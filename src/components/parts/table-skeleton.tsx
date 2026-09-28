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
 * 実テーブルの列見出しと行構造を近似し、ロード完了時のレイアウトシフトを抑える。
 *
 * 支援技術には、列見出しを持つ table と「読み込み中」の 1 行だけを見せ、skeleton の行は `aria-hidden` で隠す
 * (`docs/guides/accessibility.md`「読み込み中の表示の見せ方を選んだ理由」)。
 * `headers` は重複させない。列の key に使う。
 */
export function TableSkeleton({
  headers,
  rows = 3,
}: {
  headers: readonly string[];
  rows?: number;
}) {
  const rowKeys = Array.from({ length: rows }, (_, i) => i);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            // 実テーブルと同じく scope="col" (列見出しとして数えられる)
            <TableHead key={header} scope="col">
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* 支援技術にだけ読ませる行。registry の TableRow / TableCell は下線と余白を持ち込むので素の要素で置く */}
        <tr>
          <td colSpan={headers.length}>
            <span className="sr-only">読み込み中</span>
          </td>
        </tr>
        {rowKeys.map((row) => (
          <TableRow key={row} aria-hidden>
            {headers.map((header) => (
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
