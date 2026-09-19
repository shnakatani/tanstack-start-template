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

  // R チャンネルのみが寄与する組み合わせ。白黒 (縮退値 21:1) や同色 (係数に関係なく 1:1) では
  // 係数の取り違えを検出できないため、係数 (0.2126/0.7152/0.0722) を直接検証する
  // luminance(red) = 0.2126 * channel(255) = 0.2126 * 1 = 0.2126, luminance(白) = 1
  // 比 = (1 + 0.05) / (0.2126 + 0.05) = 1.05 / 0.2626 = 3.998477 (contrastRatio を実行して実測)
  it("R チャンネルのみのコントラストで係数を検証する", () => {
    expect(contrastRatio("rgb(255, 0, 0)", "rgb(255, 255, 255)")).toBeCloseTo(3.998477, 5);
  });

  // G チャンネルのみが寄与する組み合わせ。R より係数が大きいため差が出やすい
  // luminance(green) = 0.7152 * channel(255) = 0.7152 * 1 = 0.7152, luminance(黒) = 0
  // 比 = (0.7152 + 0.05) / (0 + 0.05) = 0.7652 / 0.05 = 15.304 (contrastRatio を実行して実測)
  it("G チャンネルのみのコントラストで係数を検証する", () => {
    expect(contrastRatio("rgb(0, 255, 0)", "rgb(0, 0, 0)")).toBeCloseTo(15.304, 5);
  });

  // r = g = b のグレーは 3 係数の合計が 1.0 なのでどの係数でも同じ値になり、係数の誤りでは落ちない。
  // ガンマ補正の指数 (2.4) とオフセット (0.055 / 1.055) が壊れたときに検出する
  // 期待値は contrastRatio を実行して実測した (4.542224959605253 を toBeCloseTo(4.542225, 5) で許容)
  it("グレーの相対輝度でガンマ補正を検証する", () => {
    expect(contrastRatio("rgb(118, 118, 118)", "rgb(255, 255, 255)")).toBeCloseTo(4.542225, 5);
  });
});
