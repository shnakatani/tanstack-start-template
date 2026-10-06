import { createColumnHelper } from "@tanstack/react-table";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DataTable } from "./data-table";
import type { DataTableFeatures } from "./data-table-features";
import { cellInColumn } from "./data-table.test-helpers";

type Price = { id: number; name: string; listPrice: number; salePrice: number };

const helper = createColumnHelper<DataTableFeatures, Price>();
// 同じ種類の値を 2 列に並べる。列を取り違えると別の値が返る
const columns = helper.columns([
  helper.accessor("name", { header: "名前" }),
  helper.accessor("listPrice", { header: "定価" }),
  helper.accessor("salePrice", { header: "売価" }),
]);
const PRICES: Price[] = [{ id: 1, name: "りんご", listPrice: 120, salePrice: 100 }];

describe("cellInColumn", () => {
  it("行の中で、列見出しの位置にある cell を返す", async () => {
    const screen = await render(
      <DataTable tableKey="prices" caption="価格の一覧" columns={columns} data={PRICES} />,
    );
    const row = screen.getByRole("row", { name: /りんご/ });

    await expect.element(cellInColumn(screen, row, "定価")).toHaveTextContent("120");
    await expect.element(cellInColumn(screen, row, "売価")).toHaveTextContent("100");
  });

  it("見出しが無い列を指すと throw する (空の locator を返して不在の assert を素通りさせない)", async () => {
    const screen = await render(
      <DataTable tableKey="prices" caption="価格の一覧" columns={columns} data={PRICES} />,
    );
    const row = screen.getByRole("row", { name: /りんご/ });
    // 見出しが描かれてから呼ぶ (cellInColumn は見出しを同期に読む)
    await expect.element(screen.getByRole("columnheader", { name: "名前" })).toBeInTheDocument();

    expect(() => cellInColumn(screen, row, "原価")).toThrow("原価");
  });

  it("同じ見出しの列が 2 つあると throw する (どちらの列か決まらない)", async () => {
    const duplicated = helper.columns([
      helper.accessor("name", { header: "名前" }),
      helper.accessor("listPrice", { header: "価格" }),
      helper.accessor("salePrice", { header: "価格" }),
    ]);
    const screen = await render(
      <DataTable tableKey="prices" caption="価格の一覧" columns={duplicated} data={PRICES} />,
    );
    const row = screen.getByRole("row", { name: /りんご/ });
    await expect.element(screen.getByRole("columnheader", { name: "名前" })).toBeInTheDocument();

    expect(() => cellInColumn(screen, row, "価格")).toThrow("価格");
  });

  it("見出しが 2 段 (列のグループ) だと throw する (グループの見出しで位置がずれる)", async () => {
    const grouped = helper.columns([
      helper.accessor("name", { header: "名前" }),
      helper.group({
        id: "prices",
        header: "価格",
        columns: helper.columns([
          helper.accessor("listPrice", { header: "定価" }),
          helper.accessor("salePrice", { header: "売価" }),
        ]),
      }),
    ]);
    const screen = await render(
      <DataTable tableKey="prices" caption="価格の一覧" columns={grouped} data={PRICES} />,
    );
    const row = screen.getByRole("row", { name: /りんご/ });
    await expect.element(screen.getByRole("columnheader", { name: "定価" })).toBeInTheDocument();

    expect(() => cellInColumn(screen, row, "定価")).toThrow("段");
  });
});
