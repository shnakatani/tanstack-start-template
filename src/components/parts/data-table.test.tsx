import type { Row } from "@tanstack/react-table";
import { createColumnHelper, Subscribe } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectRemoved } from "@/test/assert/absent";
import type { Screen } from "@/test/assert/screen-assertions";

import { DataTable } from "./data-table";
import type { DataTableCellContext, DataTableFeatures } from "./data-table-features";
import { columnHeaderWidths, expectDetailWithinTableContainer } from "./data-table.test-helpers";

type Fruit = { id: number; name: string; price: number };

const helper = createColumnHelper<DataTableFeatures, Fruit>();
const columns = helper.columns([
  helper.accessor("name", { header: "名前" }),
  helper.accessor("price", { header: "価格" }),
]);
const FRUITS: Fruit[] = [
  { id: 1, name: "りんご", price: 120 },
  { id: 2, name: "みかん", price: 80 },
];

/** 詳細の行の中身。部品と同じ形の関数を渡し、React Compiler が memo の cache を差し込んだ形で呼ぶ */
function FruitDetail({ row }: { row: Row<DataTableFeatures, Fruit> }) {
  return <p>{`${row.original.name}は${row.original.price}円`}</p>;
}

/**
 * 状態のカタログは `data-table.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは構造の契約で、
 * 列見出しの順と `scope=col`、列見出しの幅が列の `size` で決まること、`rowProps` の busy 行だけが半透明になること、
 * 空表示の `colSpan`、行を開いたときの詳細の行と、その中身の幅である。
 *
 * story の play は行を開くところだけを持つ。ほかの状態は args だけで決まる (docs/guides/storybook.md「カタログと play の範囲」)。
 * 開閉のうち、実イベントで開いて閉じること、data を描き直したとき、開けなくなったとき、列幅は、play の合成イベントと
 * story の args では作れない状態なのでここで固定する (docs/guides/storybook.md「story とブラウザテストの分担」の役割分担)。
 */
describe("DataTable", () => {
  // table は名前が必須のロール (WAI-ARIA 1.2)。HTML の table には caption で名前を付ける
  // (APG「Providing Accessible Names and Descriptions」の table の行)
  it("caption を table の名前にする", async () => {
    const screen = await render(
      <DataTable tableKey="fruits" caption="果物の一覧" columns={columns} data={FRUITS} />,
    );

    await expect.element(screen.getByRole("table", { name: "果物の一覧" })).toBeInTheDocument();
  });

  // 列幅は中身でなく列の size で決まる (ADR-0042)。列の合計より狭い器に入れ、余りの幅が列へ配られない状態で測る
  it("列見出しを列の size の幅で描く", async () => {
    const sized = helper.columns([
      helper.accessor("name", { header: "名前", size: 200 }),
      helper.accessor("price", { header: "価格", size: 120 }),
    ]);
    const screen = await render(
      <div style={{ width: 160 }}>
        <DataTable tableKey="fruits-sized" caption="果物の一覧" columns={sized} data={FRUITS} />
      </div>,
    );

    await expect.poll(() => columnHeaderWidths(screen)).toEqual([200, 120]);
  });

  it("列定義の順に列見出しを scope=col で描き、行はセル単位で描く", async () => {
    const screen = await render(
      <DataTable tableKey="fruits" caption="果物の一覧" columns={columns} data={FRUITS} />,
    );

    const headers = screen.getByRole("columnheader");
    await expect
      .poll(() => headers.elements().map((header) => header.textContent))
      .toEqual(["名前", "価格"]);
    await expect
      .element(screen.getByRole("row", { name: /りんご/ }).getByRole("cell"))
      .toHaveLength(2);
    await expect.element(screen.getByRole("cell", { name: "80" })).toBeInTheDocument();
  });

  it("rowProps で busy にした行だけを半透明にする", async () => {
    const screen = await render(
      <DataTable
        tableKey="fruits"
        caption="果物の一覧"
        columns={columns}
        data={FRUITS}
        rowProps={(row) => ({ "data-busy": row.original.id === 2 })}
      />,
    );

    await expect.element(screen.getByRole("row", { name: /みかん/ })).toHaveStyle("opacity: 0.6");
    // busy でない行は data-busy="false" で描かれる。属性の有無で当てると、この行も半透明になる
    await expect.element(screen.getByRole("row", { name: /りんご/ })).toHaveStyle("opacity: 1");
  });

  it("data が空のときは列数ぶんの colSpan を持つ案内行を 1 つ描く", async () => {
    const screen = await render(
      <DataTable tableKey="fruits" caption="果物の一覧" columns={columns} data={[]} />,
    );

    await expect
      .element(screen.getByRole("cell", { name: "データがありません" }))
      .toHaveAttribute("colspan", String(columns.length));
    await expect.element(screen.getByRole("columnheader")).toHaveLength(2);
  });

  describe("行を開く", () => {
    // 開く cell は表の状態を Table のメソッドの裏で読むので、部品の中で Subscribe する (docs/guides/lists-and-search.md「一覧テーブルを組む」)
    function ToggleCell({ row }: DataTableCellContext<Fruit>) {
      if (!row.getCanExpand()) {
        return null;
      }
      return (
        <Subscribe
          source={row.table.atoms.expanded}
          selector={(expanded) => expanded === true || expanded[row.id] === true}
        >
          {(isExpanded) => (
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={row.getToggleExpandedHandler()}
            >
              {`${row.original.name}の詳細`}
            </button>
          )}
        </Subscribe>
      );
    }

    const expandable = helper.columns([
      helper.display({ id: "toggle", header: "詳細", size: 120, cell: ToggleCell }),
      helper.accessor("name", { header: "名前", size: 200 }),
      helper.accessor("price", { header: "価格", size: 120 }),
    ]);

    function fruitTable(data: Fruit[], canExpand: (fruit: Fruit) => boolean = () => true) {
      return (
        <div style={{ width: 160 }}>
          <DataTable
            tableKey="fruits-expandable"
            caption="果物の一覧"
            columns={expandable}
            data={data}
            getRowId={(fruit) => String(fruit.id)}
            getRowCanExpand={({ original }) => canExpand(original)}
            renderSubComponent={FruitDetail}
          />
        </div>
      );
    }

    function toggle(screen: Screen, name: string) {
      return screen.getByRole("button", { name: `${name}の詳細` });
    }

    it("押すと全列をまたぐ詳細の行を出し、もう一度押すと閉じる", async () => {
      const screen = await render(fruitTable(FRUITS));
      await expect.element(toggle(screen, "りんご")).toHaveAttribute("aria-expanded", "false");

      await toggle(screen, "りんご").click();

      await expect.element(toggle(screen, "りんご")).toHaveAttribute("aria-expanded", "true");
      const detail = screen.getByRole("cell", { name: "りんごは120円" });
      await expect.element(detail).toHaveAttribute("colspan", String(expandable.length));
      await expect.element(toggle(screen, "みかん")).toHaveAttribute("aria-expanded", "false");

      await toggle(screen, "りんご").click();

      await expectRemoved(detail);
      await expect.element(toggle(screen, "りんご")).toHaveAttribute("aria-expanded", "false");
    });

    it("同じ id の行を持つ data で描き直しても、開いた行は開いたまま", async () => {
      // 詳細は関数として呼ぶ。Compiler が差し込む memo の cache が行ごとにずれても、React が警告しないことも見る
      const error = vi.spyOn(console, "error");
      const screen = await render(fruitTable(FRUITS));
      await toggle(screen, "りんご").click();
      await toggle(screen, "みかん").click();
      await toggle(screen, "りんご").click();
      await expect.element(screen.getByRole("cell", { name: "みかんは80円" })).toBeInTheDocument();

      await screen.rerender(fruitTable(FRUITS.map((fruit) => ({ ...fruit }))));

      await expect.element(screen.getByRole("cell", { name: "みかんは80円" })).toBeInTheDocument();
      await expect.element(toggle(screen, "みかん")).toHaveAttribute("aria-expanded", "true");
      expect(error).not.toHaveBeenCalled();
    });

    it("開いたあとに開けなくなった行は、詳細の行を描かない", async () => {
      const screen = await render(fruitTable(FRUITS));
      await toggle(screen, "りんご").click();
      const detail = screen.getByRole("cell", { name: "りんごは120円" });
      await expect.element(detail).toBeInTheDocument();

      // 開く手段 (ボタン) が消えた行に詳細が残ると、閉じられなくなる
      await screen.rerender(fruitTable(FRUITS, (fruit) => fruit.id !== 1));

      await expectRemoved(detail);
      await expect.element(toggle(screen, "みかん")).toBeInTheDocument();
    });

    // 詳細の中身は表の幅ではなく器の見えている幅で折り返し、表を横に送っても見えている範囲に留まる (ADR-0043)。
    // 親を flex row にするのは、器の幅を測る container が中身の幅を 0 として扱い、flex item のままだと潰れるため
    it("列の合計より狭い器では、詳細の中身を器の見えている幅に収める", async () => {
      const screen = await render(
        <div style={{ display: "flex", width: 160 }}>
          <DataTable
            tableKey="fruits-expandable"
            caption="果物の一覧"
            columns={expandable}
            data={FRUITS}
            getRowId={(fruit) => String(fruit.id)}
            getRowCanExpand={() => true}
            renderSubComponent={FruitDetail}
          />
        </div>,
      );

      await toggle(screen, "りんご").click();

      await expectDetailWithinTableContainer(screen.getByText("りんごは120円"));
    });

    // 詳細の cell は列見出しより後の行にあり、fixed layout の列幅に効かない (ADR-0042)
    it("開いても列見出しの幅を変えない", async () => {
      const screen = await render(fruitTable(FRUITS));
      await expect.poll(() => columnHeaderWidths(screen)).toEqual([120, 200, 120]);

      await toggle(screen, "りんご").click();

      await expect.element(screen.getByRole("cell", { name: "りんごは120円" })).toBeInTheDocument();
      await expect.poll(() => columnHeaderWidths(screen)).toEqual([120, 200, 120]);
    });
  });
});
