import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import {
  contrastRatio,
  flattenLayers,
  measurePair,
  parseLayerSpec,
  parseTokenTable,
  relativeLuminance,
  resolveSrgb,
  toHex,
} from "./contrast";
import { STYLES_CSS } from "./styles-css";

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
    const css = readFileSync(STYLES_CSS, "utf8");
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

  it("alpha が none の色は throw する", () => {
    // r/g/b と違い alpha は colorjs.io の型が `number` と偽る。この 1 件が無いと、
    // readAlpha と guard を丸ごと消しても全件緑のまま通る (2026-09-22 実測)。
    // 消えたときに起きるのは throw ではなく、半透明の面が消えた比が出ることである
    expect(() => resolveSrgb("rgb(0 0 0 / none)")).toThrow("none");
  });
});

describe("flattenLayers", () => {
  it("不透明な面だけなら最後の面がそのまま出る", () => {
    expect(toHex(flattenLayers(resolveSrgb("#ffffff").rgb, [resolveSrgb("#000000")]))).toBe(
      "#000000",
    );
  });

  it("半透明を下地へ合成する", () => {
    // 黒 50% を白の上に置くと中間になる
    const blended = flattenLayers(resolveSrgb("#ffffff").rgb, [resolveSrgb("#00000080")]);
    expect(blended[0]).toBeCloseTo(0.5, 2);
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
    // 2026-09-22 に axe-core 4.13.0 で得た値。再現は次のとおり。
    //   const { Color, getContrast } = axe.commons.color;
    //   const parse = (s) => { const c = new Color(); c.parseString(s); return c; };
    //   getContrast(parse("oklch(57.7% 0.245 27.325)"), parse("#ffffff"))
    // ADR-0024 の Context が変換器の裏づけとして挙げている 4.765 はこれである。
    // 上流の red-600 の値で、本リポジトリのトークンを動かしても変わらない
    const AXE_REPORTED = 4.764721882929455;
    const ratio = contrastRatio(
      resolveSrgb("oklch(57.7% 0.245 27.325)").rgb,
      resolveSrgb("oklch(1 0 0)").rgb,
    );
    expect(Math.abs(ratio - AXE_REPORTED)).toBeLessThan(1e-6);
  });

  it("閾値の帯に入る色でも axe-core の getContrast と一致する", () => {
    // 成分が (0.03928, 0.04045] に入る色。2021-05 より前の閾値 0.03928 を使うと
    // 比が 2e-4 ずれてこのテストだけが落ちる。上の 1 件は帯に入らない色なので、
    // 閾値を戻しても通ってしまう (2026-09-22 実測)
    //   const { Color, getContrast } = axe.commons.color;
    //   const parse = (s) => { const c = new Color(); c.parseString(s); return c; };
    //   getContrast(parse("oklch(0.145625 0 0)"), parse("#ffffff"))
    const AXE_REPORTED = 19.778400131206332;
    const ratio = contrastRatio(
      resolveSrgb("oklch(0.145625 0 0)").rgb,
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

describe("parseLayerSpec", () => {
  it("トークン名だけなら不透明", () => {
    expect(parseLayerSpec("--background")).toEqual({
      token: "--background",
      alpha: 1,
    });
  });

  it("スラッシュの後ろを百分率として読む", () => {
    expect(parseLayerSpec("--input/30")).toEqual({
      token: "--input",
      alpha: 0.3,
    });
  });

  it("0 を受け取る", () => {
    expect(parseLayerSpec("--input/0")).toEqual({
      token: "--input",
      alpha: 0,
    });
  });

  it("トークン名の形でなければ throw する", () => {
    expect(() => parseLayerSpec("background")).toThrow("--");
  });

  it("百分率が範囲の外なら throw する", () => {
    expect(() => parseLayerSpec("--input/120")).toThrow("0..100");
  });

  it("百分率の綴りが十進数でなければ throw する", () => {
    expect(() => parseLayerSpec("--input/half")).toThrow("十進数");
  });

  it("スラッシュの後ろが空なら throw する", () => {
    // `Number("")` は 0 なので、弾かないと書き損じが alpha 0 として通り、
    // 比 1 が「コントラストが無い」として静かに報告される
    expect(() => parseLayerSpec("--input/")).toThrow("十進数");
  });

  it("空白・指数表記・16 進は throw する", () => {
    // どれも `Number` は読むが、書いた人の意図と一致しない。0x10 は Tailwind の
    // 読み (10%) と実装の読み (16%) が食い違う
    expect(() => parseLayerSpec("--input/ 0")).toThrow("十進数");
    expect(() => parseLayerSpec("--input/1e2")).toThrow("十進数");
    expect(() => parseLayerSpec("--input/0x10")).toThrow("十進数");
  });

  it("スラッシュが 2 つ以上あれば throw する", () => {
    // 3 要素目以降を黙って捨てると、下地の 2 枚指定を 1 引数へ詰めた書き損じが通る
    expect(() => parseLayerSpec("--input/30/40")).toThrow("1 つだけ");
  });

  it("小数と 0 詰めは通す", () => {
    // 読み方が 1 つに定まる綴り。既存の `--input/30.5` を通す挙動も保つ
    expect(parseLayerSpec("--input/00")).toEqual({
      token: "--input",
      alpha: 0,
    });
    expect(parseLayerSpec("--input/0.0")).toEqual({
      token: "--input",
      alpha: 0,
    });
    expect(parseLayerSpec("--input/30.5")).toEqual({
      token: "--input",
      alpha: 0.305,
    });
  });

  it("100 を受け取る", () => {
    // 上限そのものが通ること。`>= 100` にすると落ちる
    expect(parseLayerSpec("--input/100")).toEqual({
      token: "--input",
      alpha: 1,
    });
  });
});

describe("measurePair", () => {
  const TABLE = {
    "--white": "#ffffff",
    "--black": "#000000",
  };

  it("下地を下から順に重ねてから前景を載せる", () => {
    const measured = measurePair({
      table: TABLE,
      backdrop: [parseLayerSpec("--white")],
      foreground: parseLayerSpec("--black"),
    });
    expect(measured.ratio).toBeCloseTo(21, 10);
    expect(toHex(measured.backdrop)).toBe("#ffffff");
    expect(toHex(measured.foreground)).toBe("#000000");
  });

  it("半透明の前景を下地へ合成してから比を取る", () => {
    // 範囲だけを見る assert は、不透明時は正しく半透明時だけ狂うバグを見逃す
    const measured = measurePair({
      table: TABLE,
      backdrop: [parseLayerSpec("--white")],
      foreground: parseLayerSpec("--black/50"),
    });
    expect(toHex(measured.foreground)).toBe("#808080");
    expect(measured.ratio).toBeCloseTo(3.976653024912438, 10);
  });

  it("下地が白以外でも、その下地の上へ前景を合成する", () => {
    // 合成先を白の決め打ちにしても、下地が白のケースだけでは落ちない
    const measured = measurePair({
      table: TABLE,
      backdrop: [parseLayerSpec("--black")],
      foreground: parseLayerSpec("--white/50"),
    });
    expect(toHex(measured.backdrop)).toBe("#000000");
    expect(toHex(measured.foreground)).toBe("#808080");
  });

  it("下地を渡した順に下から重ねる", () => {
    // 1 枚だけのケースでは順序を主張できない。逆順に渡すと、透けた面が
    // いちばん下に来て `measurePair` の guard が throw する
    const measured = measurePair({
      table: TABLE,
      backdrop: [parseLayerSpec("--black"), parseLayerSpec("--white/50")],
      foreground: parseLayerSpec("--black"),
    });
    expect(toHex(measured.backdrop)).toBe("#808080");
    expect(() =>
      measurePair({
        table: TABLE,
        backdrop: [parseLayerSpec("--white/50"), parseLayerSpec("--black")],
        foreground: parseLayerSpec("--black"),
      }),
    ).toThrow("不透明");
  });

  it("下地が 3 枚以上でも渡した順に重ねる", () => {
    // 2 枚だと `flattenLayers` の reduce が 1 回しか回らず、順序を反転しても同じ色になる。
    // 3 枚にして初めて、重ね順そのものを固定できる
    const table = { "--w": "#ffffff", "--r": "#ff0000", "--b": "#0000ff" };
    const backdropOf = (order: readonly string[]) =>
      toHex(
        measurePair({
          table,
          backdrop: order.map(parseLayerSpec),
          foreground: parseLayerSpec("--w"),
        }).backdrop,
      );
    expect(backdropOf(["--w", "--r/50", "--b/50"])).toBe("#8040bf");
    expect(backdropOf(["--w", "--b/50", "--r/50"])).toBe("#bf4080");
  });

  it("表に無いトークンは throw する", () => {
    expect(() =>
      measurePair({
        table: TABLE,
        backdrop: [parseLayerSpec("--white")],
        foreground: parseLayerSpec("--missing"),
      }),
    ).toThrow("--missing");
  });

  it("色でない宣言はトークン名を添えて throw する", () => {
    // `TokenTable` には `--radius` のような色でない宣言も入る。colorjs.io の素の
    // メッセージは値しか持たず、どの --bg が原因か分からない
    expect(() =>
      measurePair({
        table: { ...TABLE, "--radius": "0.625rem" },
        backdrop: [parseLayerSpec("--white")],
        foreground: parseLayerSpec("--radius"),
      }),
    ).toThrow("--radius");
  });

  it("いちばん下の下地が半透明ならトークン名を添えて throw する", () => {
    // どの --bg が原因か分からないと、下地を複数枚渡したときに辿れない
    expect(() =>
      measurePair({
        table: TABLE,
        backdrop: [parseLayerSpec("--white/50")],
        foreground: parseLayerSpec("--black"),
      }),
    ).toThrow("--white");
  });

  it("下地が 1 枚も無ければ throw する", () => {
    // CLI は `--bg` を必須にしているが、ライブラリとして呼ばれる経路では起こりうる
    expect(() =>
      measurePair({ table: TABLE, backdrop: [], foreground: parseLayerSpec("--black") }),
    ).toThrow("下地が 1 枚も渡されていない");
  });
});
