import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { isColor, toRgb } from "./css-color.story-helpers";

describe("toRgb", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("oklch() を rgb(r, g, b) へ正規化する", () => {
    expect(toRgb("oklch(1 0 0)")).toBe("rgb(255, 255, 255)");
  });

  it("無効な色は null を返し warn する", () => {
    expect(toRgb("not-a-color")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("[css-color] 色として解析できない値", {
      cssColor: "not-a-color",
    });
  });

  it("空文字列 (未定義のカスタムプロパティを resolved() で読んだときの値) は null を返す", () => {
    expect(toRgb("")).toBeNull();
  });
});

describe("isColor", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("色として解決できる値には true を返す", () => {
    expect(isColor("oklch(1 0 0)")).toBe(true);
    expect(isColor("rgb(0, 0, 0)")).toBe(true);
  });

  it("色でない値には false を返す。tokens.stories.tsx の振り分けに使う述語なので warn しない", () => {
    expect(isColor("0.625rem")).toBe(false);
    expect(isColor("")).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
