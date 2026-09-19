import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  dropRedundantColorAliases,
  foregroundPairs,
  isColorValue,
} from "./theme-tokens.story-helpers";

describe("dropRedundantColorAliases", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("生トークンが同じ値で在る --color-X を落とす", () => {
    const tokens = [
      { name: "--color-primary", value: "oklch(0.5 0.2 260)" },
      { name: "--primary", value: "oklch(0.5 0.2 260)" },
    ];

    expect(dropRedundantColorAliases(tokens)).toEqual([
      { name: "--primary", value: "oklch(0.5 0.2 260)" },
    ]);
  });

  it("対応する生トークンが無い --color-X は残す", () => {
    const tokens = [{ name: "--color-black", value: "#000" }];

    expect(dropRedundantColorAliases(tokens)).toEqual(tokens);
  });

  it("--color- で始まらないトークンは残す", () => {
    const tokens = [{ name: "--primary", value: "oklch(0.5 0.2 260)" }];

    expect(dropRedundantColorAliases(tokens)).toEqual(tokens);
  });

  it("値が食い違う別名は落とさず warn する", () => {
    const tokens = [
      { name: "--color-primary", value: "oklch(0.9 0 0)" },
      { name: "--primary", value: "oklch(0.5 0.2 260)" },
    ];

    expect(dropRedundantColorAliases(tokens)).toEqual(tokens);
    expect(warnSpy).toHaveBeenCalledWith("[theme-tokens] 別名と生トークンの値が食い違う", {
      alias: "--color-primary",
      aliasValue: "oklch(0.9 0 0)",
      raw: "--primary",
      rawValue: "oklch(0.5 0.2 260)",
    });
  });

  it("--color- だけの名前は生トークン名が空になるので残す", () => {
    const tokens = [{ name: "--color-", value: "#000" }];

    expect(dropRedundantColorAliases(tokens)).toEqual(tokens);
  });
});

describe("foregroundPairs", () => {
  it("--X-foreground と --X を対にする", () => {
    const tokens = [
      { name: "--primary", value: "oklch(0.5 0.2 260)" },
      { name: "--primary-foreground", value: "oklch(0.98 0 0)" },
    ];

    expect(foregroundPairs(tokens)).toEqual([
      {
        foreground: { name: "--primary-foreground", value: "oklch(0.98 0 0)" },
        background: { name: "--primary", value: "oklch(0.5 0.2 260)" },
      },
    ]);
  });

  it("--foreground は --background と対にする", () => {
    const tokens = [
      { name: "--background", value: "oklch(1 0 0)" },
      { name: "--foreground", value: "oklch(0.13 0.04 264)" },
    ];

    expect(foregroundPairs(tokens).map(({ background }) => background.name)).toEqual([
      "--background",
    ]);
  });

  it("相手のいない -foreground は落とす", () => {
    expect(foregroundPairs([{ name: "--orphan-foreground", value: "#000" }])).toEqual([]);
  });

  it("-foreground を持たないトークンは対にならない", () => {
    expect(foregroundPairs([{ name: "--border", value: "#000" }])).toEqual([]);
  });

  it("名前順に並べる", () => {
    const tokens = [
      { name: "--card", value: "#fff" },
      { name: "--card-foreground", value: "#000" },
      { name: "--accent", value: "#eee" },
      { name: "--accent-foreground", value: "#111" },
    ];

    expect(foregroundPairs(tokens).map(({ foreground }) => foreground.name)).toEqual([
      "--accent-foreground",
      "--card-foreground",
    ]);
  });
});

describe("isColorValue", () => {
  it("CSS の色として書かれた値を通す", () => {
    expect(isColorValue("oklch(0.5 0.2 260)")).toBe(true);
    expect(isColorValue("#000")).toBe(true);
    expect(isColorValue("rgb(1, 2, 3)")).toBe(true);
  });

  it("色でない値を落とす", () => {
    expect(isColorValue("0.625rem")).toBe(false);
    expect(isColorValue("0.25s")).toBe(false);
    expect(isColorValue("Geist Variable, sans-serif")).toBe(false);
  });

  // culori の parse は # の無い hex を受ける (parse("700") -> #700、2026-09-20 実測)。
  // --font-weight-bold: 700 のような数値トークンが色として通ってしまう
  it("# の無い hex 相当の数値を落とす", () => {
    expect(isColorValue("700")).toBe(false);
    expect(isColorValue("400")).toBe(false);
    expect(isColorValue("100")).toBe(false);
    expect(isColorValue("aabbcc")).toBe(false);
  });
});
