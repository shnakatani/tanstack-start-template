import { createColumnHelper } from "@tanstack/react-table";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DataTable } from "./data-table";
import { type DataTableFeatures } from "./data-table-features";

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

describe("DataTable", () => {
  it("列定義の順に列見出しを scope=col で描き、行はセル単位で描く", async () => {
    const screen = await render(<DataTable tableKey="fruits" columns={columns} data={FRUITS} />);

    const headers = screen.getByRole("columnheader").all();
    expect(headers.map((header) => header.element().textContent)).toEqual(["名前", "価格"]);
    expect(
      screen
        .getByRole("row", { name: /りんご/ })
        .getByRole("cell")
        .all(),
    ).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "80" }).query()).not.toBeNull();
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

    const cell = screen.getByRole("cell", { name: "データがありません" }).element();
    expect(cell.getAttribute("colspan")).toBe(String(columns.length));
    expect(screen.getByRole("columnheader").all()).toHaveLength(2);
  });
});
