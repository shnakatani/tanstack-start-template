import type { Row, RowData, TableOptions } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useTanStackTableDevtools } from "@tanstack/react-table-devtools";
import type { ReactNode } from "react";
import { Fragment } from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { columnWidthFrom } from "./data-table-columns";
import type { DataTableFeatures } from "./data-table-features";
import { dataTableFeatures } from "./data-table-features";

/** 転送する option の型は `useTable` の options から導出する (再宣言すると転送先の型変更に追随しない) */
interface DataTableBaseProps<TData extends RowData> extends Pick<
  TableOptions<DataTableFeatures, TData>,
  "columns" | "data" | "getRowId"
> {
  /** devtools に登録する識別子。画面ごとに一意にする (`useTable` の `key`) */
  tableKey: string;
  /**
   * table の名前。見た目には出さず caption に置く。読み込み中の `TableSkeleton` にも同じ値を渡し、
   * 本体へ置き換わっても名前を変えない (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
   */
  caption: string;
  /**
   * 行ごとに足す属性。行データから決まるものを返す。
   *
   * `className` は受けない。返した class は `rowProps` のコールバックの中にあって
   * `no-restyle` が追えず、`<TableRow>` へ直接書けば落ちる class が無診断で通る。
   * 外見は部品が持つ (ADR-0022)。半透明は registry の `TableRow` が `data-busy` から当てる。
   */
  rowProps?: (row: Row<DataTableFeatures, TData>) => { "data-busy"?: boolean };
  /** data が空のときに 1 行で出す案内。画面が `Empty` 部品を別に持つなら描画側で分岐する */
  emptyText?: string;
}

/**
 * 行を開いて詳細の行を出す 2 つの prop。片方だけでは、開いても何も出ないか、開く手段が無いので対で渡す。
 * 開いた状態は row id をキーに持ち、data を描き直しても戻さない (下の `autoResetExpanded`)。index の id だと、
 * 行が消えたときに開いた状態が隣の行へ移るので、対で渡すときは `getRowId` も要る (ADR-0043)
 */
type DataTableExpandingProps<TData extends RowData> =
  | { getRowCanExpand?: undefined; renderSubComponent?: undefined }
  | (Required<Pick<TableOptions<DataTableFeatures, TData>, "getRowCanExpand" | "getRowId">> & {
      /**
       * 開いた行の直後に、全列をまたぐ 1 つの cell の中へ描く。中身の幅は表の器の見えている幅で、`DataTable` が
       * 決める (ADR-0043)。JSX の子としては描かず関数として呼ぶので、hook を呼ばない関数を渡す
       */
      renderSubComponent: (props: { row: Row<DataTableFeatures, TData> }) => ReactNode;
    });

type DataTableProps<TData extends RowData> = DataTableBaseProps<TData> &
  DataTableExpandingProps<TData>;

/**
 * 列定義 (TanStack Table v9) を registry の `Table` 部品に描く共有部品 (ADR-0018)。
 * 列見出しの `scope="col"` の理由も ADR-0018。
 */
export function DataTable<TData extends RowData>({
  tableKey,
  caption,
  columns,
  data,
  getRowId,
  rowProps,
  emptyText = "データがありません",
  getRowCanExpand,
  renderSubComponent,
}: DataTableProps<TData>) {
  const table = useTable({
    key: tableKey,
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    getRowCanExpand,
    // 既定では data の参照が変わるたびに開いた行を閉じる。一覧は操作中の行の表示のために data を組み直すので、
    // 戻さない (TanStack Table の guide「Expanding」の Auto Reset Expanded State)
    autoResetExpanded: false,
  });
  useTanStackTableDevtools(table);
  const rows = table.getRowModel().rows;

  return (
    // 詳細の行の中身の幅を、横に scroll する器の見えている幅から採る (ADR-0043)。器は registry の Table が描き、className は
    // table に付くので、器と同じ幅の外側の div を container にする。container は自分の中身の幅を 0 として扱うので、
    // flex row の親の中でも潰れないよう w-full を当てる
    <div className="@container w-full">
      {/* 列の幅は列定義の size で決め、中身で変えない。操作中の表示で中身の幅が変わっても列が動かない (ADR-0042)。
          fixed layout は最初の行の cell から列幅を採るので、幅は列見出しにだけ当てる */}
      <Table className="table-fixed">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  scope="col"
                  style={{ width: columnWidthFrom(header.getSize()) }}
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              // 受け取った値から data-busy だけを取り出して渡す。spread にすると、返り値の型に
              // 無い className がリテラルでない経路 (const props = {...}; () => props) で載って
              // しまい、JSX の後勝ちで静かに落ちる
              const busy = rowProps?.(row)["data-busy"];
              return (
                <Fragment key={row.id}>
                  <TableRow data-busy={busy}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* 開けなくなった行 (開いたあとに中身が消えたなど) は、閉じるボタンも消えるので詳細を描かない */}
                  {renderSubComponent !== undefined &&
                    row.getIsExpanded() &&
                    row.getCanExpand() && (
                      // 本体の行と同じ busy を持たせ、半透明をそろえる
                      <TableRow data-busy={busy}>
                        <TableCell colSpan={row.getAllCells().length}>
                          {/* 表の幅ではなく器の見えている幅で折り返し、表を横に送っても見えている範囲に留める (ADR-0043)。
                              left-2 と --spacing(4) は registry の TableCell の p-2 の左と左右の和に合わせた値で、p-2 が変わるとずれる。
                              TableCell の whitespace-nowrap は中身へ継承されるので、ここで折り返しに戻す */}
                          <div className="sticky left-2 w-[calc(100cqi-(--spacing(4)))] wrap-break-word whitespace-normal">
                            {renderSubComponent({ row })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </Fragment>
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
    </div>
  );
}
