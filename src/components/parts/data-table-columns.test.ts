import { describe, expect, it } from "vite-plus/test";

import { columnBaseFrom } from "./data-table-columns";

describe("columnBaseFrom", () => {
  it("列の id と、その id の見出しを返す", () => {
    const base = columnBaseFrom({ name: "名前", price: "価格" });

    expect(base("price")).toEqual({ id: "price", header: "価格" });
  });
});
