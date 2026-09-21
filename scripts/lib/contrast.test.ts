import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { parseTokenTable } from "./contrast";
import { REPO_ROOT } from "./repo-root";

// 実ファイルではなく固定の CSS で境界条件を試す。実ファイルの値を期待値にすると、
// トークンを動かすたびに期待値の書き換えしか選択肢が無い検査になる
const FIXTURE = `
/* コメントの中の --background: oklch(0 0 0); は拾わない */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  --destructive-surface: oklch(
    57.7% 0.245 27.325
  ); /* 複数行にまたがる宣言 */
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

  it("実際の src/styles.css を読める", () => {
    const css = readFileSync(join(REPO_ROOT, "src", "styles.css"), "utf8");
    const table = parseTokenTable(css);
    // 値ではなく「引けること」だけを固定する。値はトークンを動かすと変わる
    expect(table.light["--background"]).toBeDefined();
    expect(table.dark["--background"]).toBeDefined();
  });
});
