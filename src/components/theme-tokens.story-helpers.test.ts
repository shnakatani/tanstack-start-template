import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { dropRedundantColorAliases } from "./theme-tokens.story-helpers";

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
