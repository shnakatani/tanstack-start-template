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
    const screen = await render(<DataTable tableKey="prices" columns={columns} data={PRICES} />);
    const row = screen.getByRole("row", { name: /りんご/ });

    await expect.element(cellInColumn(screen, row, "定価")).toHaveTextContent("120");
    await expect.element(cellInColumn(screen, row, "売価")).toHaveTextContent("100");
  });

  it("見出しが無い列を指すと throw する (空の locator を返して不在の assert を素通りさせない)", async () => {
    const screen = await render(<DataTable tableKey="prices" columns={columns} data={PRICES} />);
    const row = screen.getByRole("row", { name: /りんご/ });
    // 見出しが描かれてから呼ぶ (cellInColumn は見出しを同期に読む)
    await expect.element(screen.getByRole("columnheader", { name: "名前" })).toBeInTheDocument();

    expect(() => cellInColumn(screen, row, "原価")).toThrow("原価");
  });
});
