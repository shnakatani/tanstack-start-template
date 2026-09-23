import { createColumnHelper } from "@tanstack/react-table";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";

type Fruit = { id: number; name: string; price: number };

const helper = createColumnHelper<DataTableFeatures, Fruit>();
const columns = helper.columns([
  helper.accessor("name", { header: "名前" }),
  helper.accessor("price", { header: "価格", meta: { cellClassName: "text-right" } }),
]);
const FRUITS: Fruit[] = [
  { id: 1, name: "りんご", price: 120 },
  { id: 2, name: "みかん", price: 80 },
];

/**
 * 状態のカタログは `data-table.stories.tsx` が持つ (ADR-0044)。ここに残すのは構造の契約で、
 * 列見出しの順と `scope=col`、`cellClassName` の転写、`rowProps` の属性、空表示の `colSpan`
 * である。busy 行の半透明は Tailwind の `aria-busy:` variant が CSS で当てるので、JS の分岐も
 * それを測るテストも無い。見え方は `BusyRow` story が持つ。
 *
 * この部品は args だけで状態が決まるので story に play を書かない (ADR-0044)。play の無い
 * story は描画と axe しか走らせないため、上の契約はここでしか固定できない (ADR-0050 の
 * 役割分担)。
 */
describe("DataTable", () => {
  it("列定義の順に列見出しを scope=col で描き、行はセル単位で描く", async () => {
    const screen = await render(<DataTable tableKey="fruits" columns={columns} data={FRUITS} />);

    const headers = screen.getByRole("columnheader");
    await expect
      .poll(() => headers.elements().map((header) => header.textContent))
      .toEqual(["名前", "価格"]);
    await expect
      .element(screen.getByRole("row", { name: /りんご/ }).getByRole("cell"))
      .toHaveLength(2);
    await expect.element(screen.getByRole("cell", { name: "80" })).toBeInTheDocument();
  });

  it("列定義の cellClassName をセルに写す", async () => {
    const screen = await render(<DataTable tableKey="fruits" columns={columns} data={FRUITS} />);

    await expect.element(screen.getByRole("cell", { name: "120" })).toHaveClass("text-right");
    await expect
      .element(screen.getByRole("cell", { name: "りんご" }))
      .not.toHaveClass("text-right");
  });

  it("rowProps で行ごとの属性を足せる", async () => {
    const screen = await render(
      <DataTable
        tableKey="fruits"
        columns={columns}
        data={FRUITS}
        rowProps={(row) => ({ "aria-busy": row.original.id === 2 })}
      />,
    );

    await expect
      .element(screen.getByRole("row", { name: /みかん/ }))
      .toHaveAttribute("aria-busy", "true");
    await expect
      .element(screen.getByRole("row", { name: /りんご/ }))
      .toHaveAttribute("aria-busy", "false");
  });

  it("data が空のときは列数ぶんの colSpan を持つ案内行を 1 つ描く", async () => {
    const screen = await render(<DataTable tableKey="fruits" columns={columns} data={[]} />);

    await expect
      .element(screen.getByRole("cell", { name: "データがありません" }))
      .toHaveAttribute("colspan", String(columns.length));
    await expect.element(screen.getByRole("columnheader")).toHaveLength(2);
  });
});
