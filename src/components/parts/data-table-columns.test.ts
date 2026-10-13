import { describe, expect, it } from "vite-plus/test";

import { columnBaseFrom, columnWidthFrom } from "./data-table-columns";

describe("columnBaseFrom", () => {
  it("列の id と、その id の見出しと幅を返す", () => {
    const base = columnBaseFrom({
      name: { header: "名前", size: 200 },
      price: { header: "価格", size: 120 },
    });

    expect(base("price")).toEqual({ id: "price", header: "価格", size: 120 });
  });
});

describe("columnWidthFrom", () => {
  // 既定の root の文字サイズ 16px で割る
  it.each([
    // 0 / 16 = 0
    [0, "0rem"],
    // 16 / 16 = 1
    [16, "1rem"],
    // 152 / 16 = 9.5 (16 で割り切れない size は小数の rem になる)
    [152, "9.5rem"],
  ])("size %i を %s にする", (size, width) => {
    expect(columnWidthFrom(size)).toBe(width);
  });
});
