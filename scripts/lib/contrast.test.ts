import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  contrastRatio,
  flattenLayers,
  parseTokenTable,
  relativeLuminance,
  resolveSrgb,
  toHex,
} from "./contrast";
import { REPO_ROOT } from "./repo-root";

// 実ファイルではなく固定の CSS で境界条件を試す。実ファイルの値を期待値にすると、
// トークンを動かすたびに期待値の書き換えしか選択肢が無い検査になる
const FIXTURE = `
:root {
  --background: oklch(1 0 0);
  /* 上流の値に戻すときはこちら
  --foreground: oklch(0 0 0);
  --background: oklch(9 9 9);
  */
  --foreground: oklch(0.148 0.004 228.8);
  --destructive-surface: oklch(
    57.7% 0.245 27.325
  ); /* 複数行にまたがる宣言 */
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.148 0.004 228.8);
}
`;

describe("parseTokenTable", () => {
  it("宣言をトークン名から引ける", () => {
    expect(parseTokenTable(FIXTURE).light["--foreground"]).toBe("oklch(0.148 0.004 228.8)");
  });

  it("複数行にまたがる宣言を 1 つの値にまとめる", () => {
    expect(parseTokenTable(FIXTURE).light["--destructive-surface"]).toBe(
      "oklch( 57.7% 0.245 27.325 )",
    );
  });

  it("コメントの中の宣言を拾わない", () => {
    // コメントアウトした宣言が 2 本あると、2 本目が `;` で割った断片の先頭に来る。
    // 除去を外すと `oklch(9 9 9)` が後勝ちで残る。1 本だけの形では宣言の正規表現の `^`
    // が先に弾いて、除去の有無が結果に出ない (2026-09-22 実測)
    expect(parseTokenTable(FIXTURE).light["--background"]).toBe("oklch(1 0 0)");
  });

  it("dark は :root に重ねる (再宣言しないトークンは light の値を引き継ぐ)", () => {
    const table = parseTokenTable(FIXTURE);
    expect(table.dark["--background"]).toBe("oklch(0.148 0.004 228.8)");
    expect(table.dark["--foreground"]).toBe("oklch(0.148 0.004 228.8)");
  });

  it("セレクタが無い CSS は throw する", () => {
    // 宣言ブロックの閉じ括弧は改行の後ろに置く。`:root { }` は :root 側で落ちる
    expect(() => parseTokenTable(":root {\n}")).toThrow(".dark");
  });

  it("入れ子のブロックがあれば throw する", () => {
    const nested = `:root {
  --background: oklch(1 0 0);
  @media (prefers-contrast: more) {
    --foreground: oklch(0 0 0);
  }
}
.dark {
  --background: oklch(0 0 0);
}
`;
    expect(() => parseTokenTable(nested)).toThrow("入れ子");
  });

  it("閉じ括弧が行頭にないブロックは throw する", () => {
    // 前のテストと同じ `body.includes("{")` のガードに当たるが、到達の経路が違う。
    // 入れ子は `:root` の本体に最初から `{` がある形で、こちらは `:root` の抽出が
    // 次のブロックまで走った結果として `{` が入り込む形である。ガードが無いと
    // light の表が dark の値になる。抽出の仕方を変えれば 2 つは別の要件に戻るので、
    // 実装がいま 1 条件であることを理由にどちらかを消さない
    const inline = `:root { --background: oklch(1 0 0); }
.dark { --background: oklch(0 0 0);
}
`;
    expect(() => parseTokenTable(inline)).toThrow("入れ子");
  });

  it("@media が :root を外から包む形は throw する", () => {
    // 止めないと、条件付きの値が無条件のトークンとして表へ入る
    const wrapped = `@media (prefers-contrast: more) {
  :root {
    --background: oklch(0 0 0);
  }
}
.dark {
  --background: oklch(0.2 0 0);
}
`;
    expect(() => parseTokenTable(wrapped)).toThrow("行頭");
  });

  it("@media 内と行頭の両方に :root があれば行頭側を読む", () => {
    const both = `@media (prefers-contrast: more) {
  :root {
    --background: oklch(9 9 9);
  }
}
:root {
  --background: oklch(1 0 0);
}
.dark {
  --background: oklch(0.2 0 0);
}
`;
    expect(parseTokenTable(both).light["--background"]).toBe("oklch(1 0 0)");
  });

  it("色でない宣言も表に入る", () => {
    // docstring の契約。色に絞る判定は値を解決する側が持つ
    expect(parseTokenTable(FIXTURE).light["--radius"]).toBe("0.625rem");
  });

  it("実際の src/styles.css を読める", () => {
    const css = readFileSync(join(REPO_ROOT, "src", "styles.css"), "utf8");
    const table = parseTokenTable(css);
    // 値ではなく「引けること」だけを固定する。値はトークンを動かすと変わる
    expect(table.light["--background"]).toBeDefined();
    expect(table.dark["--background"]).toBeDefined();
  });
});

describe("resolveSrgb", () => {
  it("oklch を sRGB へ解決する", () => {
    expect(toHex(resolveSrgb("oklch(57.7% 0.245 27.325)").rgb)).toBe("#e7000b");
  });

  it("sRGB の外へ出る色を 0..1 へ収める", () => {
    // `toGamut` は oklch 空間で clip するので、sRGB へ戻すと成分が範囲の外へわずかに出る。
    // 収めないと相対輝度が定義域の外で計算され、存在しない比が出る
    const { rgb } = resolveSrgb("oklch(0.7 0.35 145)");
    expect(rgb.every((channel) => channel >= 0 && channel <= 1)).toBe(true);
    // clip 自体が効いていること (収めるだけなら 0 が並ぶので、緑が残ることを見る)
    expect(rgb[1]).toBeGreaterThan(0.5);
  });

  it("alpha を保つ", () => {
    expect(resolveSrgb("oklch(1 0 0 / 10%)").alpha).toBeCloseTo(0.1, 10);
  });

  it("none を含む色は throw する", () => {
    // 2026-09-22 に colorjs.io 0.7.1 で実測: `oklch(0.5 none 180)` は sRGB へ変換する
    // 過程で none が 0 に解決されるため null にならない。null が残るのは sRGB のまま
    // 渡した場合で、0 として扱うと存在しない比が出る
    expect(() => resolveSrgb("rgb(none 0 0)")).toThrow("none");
  });
});

describe("flattenLayers", () => {
  it("不透明な面だけなら最後の面がそのまま出る", () => {
    const white = resolveSrgb("#ffffff");
    const black = resolveSrgb("#000000");
    expect(toHex(flattenLayers([white, black]))).toBe("#000000");
  });

  it("半透明を下地へ合成する", () => {
    // 黒 50% を白の上に置くと中間になる
    const blended = flattenLayers([resolveSrgb("#ffffff"), resolveSrgb("#00000080")]);
    expect(blended[0]).toBeCloseTo(0.5, 2);
  });

  it("いちばん下の面が透けていたら throw する", () => {
    // 下地が無いまま合成すると、何に載るかで変わる比を 1 つに決めてしまう
    expect(() => flattenLayers([resolveSrgb("#00000080")])).toThrow("不透明");
  });

  it("面が 0 枚なら throw する", () => {
    expect(() => flattenLayers([])).toThrow("不透明");
  });
});

describe("contrastRatio", () => {
  it("白と黒は 21", () => {
    expect(contrastRatio(resolveSrgb("#ffffff").rgb, resolveSrgb("#000000").rgb)).toBeCloseTo(
      21,
      10,
    );
  });

  it("同じ色どうしは 1", () => {
    const rgb = resolveSrgb("#123456").rgb;
    expect(contrastRatio(rgb, rgb)).toBeCloseTo(1, 10);
  });

  it("前景と背景を入れ替えても同じ", () => {
    const a = resolveSrgb("#e7000b").rgb;
    const b = resolveSrgb("#ffffff").rgb;
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("axe-core の getContrast と一致する", () => {
    // 2026-09-22 に axe-core 4.13.0 の
    // `axe.commons.color.getContrast(parseString("oklch(57.7% 0.245 27.325)"), parseString("#ffffff"))`
    // が返した値。ADR-0024 の Context が変換器の裏づけとして挙げている 4.765 はこれである。
    // 上流の red-600 の値で、本リポジトリのトークンを動かしても変わらない
    const AXE_REPORTED = 4.764721882929455;
    const ratio = contrastRatio(
      resolveSrgb("oklch(57.7% 0.245 27.325)").rgb,
      resolveSrgb("oklch(1 0 0)").rgb,
    );
    expect(Math.abs(ratio - AXE_REPORTED)).toBeLessThan(1e-6);
  });
});

describe("relativeLuminance", () => {
  it("白は 1、黒は 0", () => {
    expect(relativeLuminance(resolveSrgb("#ffffff").rgb)).toBeCloseTo(1, 10);
    expect(relativeLuminance(resolveSrgb("#000000").rgb)).toBeCloseTo(0, 10);
  });
});
