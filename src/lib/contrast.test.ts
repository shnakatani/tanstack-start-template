import { describe, expect, it } from "vite-plus/test";

import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  // WCAG 2.1 の相対輝度は白 1.0 / 黒 0.0 で、比は (1.0 + 0.05) / (0.0 + 0.05) = 21
  it("白と黒は 21:1", () => {
    expect(contrastRatio("rgb(255, 255, 255)", "rgb(0, 0, 0)")).toBeCloseTo(21, 2);
  });

  it("同じ色は 1:1", () => {
    expect(contrastRatio("rgb(120, 120, 120)", "rgb(120, 120, 120)")).toBeCloseTo(1, 2);
  });

  // 前景と背景を入れ替えても比は変わらない (明るい側が分子に来る)
  it("引数の順序で結果が変わらない", () => {
    const a = contrastRatio("rgb(255, 255, 255)", "rgb(100, 100, 100)");
    const b = contrastRatio("rgb(100, 100, 100)", "rgb(255, 255, 255)");
    expect.assert(a !== null, "a が null になった");
    expect.assert(b !== null, "b が null になった");
    expect(a).toBeCloseTo(b, 5);
  });

  // alpha 付きは合成結果が分からないので扱わない。呼び出し側が解決済みの色を渡す契約にする
  it("解析できない色は null を返す", () => {
    expect(contrastRatio("transparent", "rgb(0, 0, 0)")).toBeNull();
  });
});
