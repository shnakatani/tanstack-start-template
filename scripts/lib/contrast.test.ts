import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { parseTokenTable } from "./contrast";
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
