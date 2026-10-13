import { describe, expect, it } from "vite-plus/test";

import { columnBaseFrom } from "./data-table-columns";

describe("columnBaseFrom", () => {
  it("列の id と、その id の見出しと幅を返す", () => {
    const base = columnBaseFrom({
      name: { header: "名前", size: 200 },
      price: { header: "価格", size: 120 },
    });

    expect(base("price")).toEqual({ id: "price", header: "価格", size: 120 });
  });
});
