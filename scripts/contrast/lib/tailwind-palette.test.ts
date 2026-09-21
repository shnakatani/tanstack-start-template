import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { REPO_ROOT } from "../../lib/repo-root";
import { tailwindPalette } from "./tailwind-palette";

describe("tailwindPalette", () => {
  it("段のある色は --color-<色>-<段> で引ける", () => {
    const table = tailwindPalette();
    expect(table["--color-orange-800"]).toBeDefined();
    expect(table["--color-orange-50"]).toBeDefined();
  });

  it("段を持たない色は --color-<色> で引ける", () => {
    // `black` / `white` は段を持たず文字列で来る。段の側と同じ形で畳むと名前が壊れる
    expect(tailwindPalette()["--color-black"]).toBe("#000");
  });

  it("同梱の theme.css と同じ値を返す", () => {
    // 値の出どころが公式 export で、CSS を読んだ場合と一致することを固定する。
    // ずれたら `@theme` を読む形へ戻す判断が要る
    const theme = readFileSync(join(REPO_ROOT, "node_modules", "tailwindcss", "theme.css"), "utf8");
    const table = tailwindPalette();
    const declared = [...theme.matchAll(/(--color-[a-z]+-\d+):\s*([^;]+);/g)];
    expect(declared.length).toBeGreaterThan(200);
    for (const [, name, value] of declared) {
      expect(table[String(name)]).toBe(String(value).trim());
    }
  });
});
