import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createColorParser, isColor } from "./css-color.story-helpers";

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

describe("isColor の sentinel", () => {
  // 既知の値を 1 つにすると、その値そのものを判定したときに落ちる
  it("sentinel と同じ値そのものも色として通す", () => {
    expect(isColor("#010203")).toBe(true);
    expect(isColor("rgb(1, 2, 3)")).toBe(true);
  });

  it("非色トークンの実際の値を落とす", () => {
    expect(isColor("calc(0.625rem - 4px)")).toBe(false);
    expect(isColor("spin 1s linear infinite")).toBe(false);
    expect(isColor('"Geist Variable", sans-serif')).toBe(false);
  });
});

describe("createColorParser の失敗経路", () => {
  afterEach(() => vi.restoreAllMocks());

  it("2D context が取れないと全件を非色として返す", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const isColorValue = createColorParser(() => null);

    expect(isColorValue("#fff")).toBe(false);
    expect(isColorValue("oklch(1 0 0)")).toBe(false);
  });

  it("warn はトークンの数だけ出さず 1 度だけ", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const isColorValue = createColorParser(() => null);

    isColorValue("#fff");
    isColorValue("#000");
    isColorValue("oklch(1 0 0)");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[css-color] canvas の 2D context を取得できない。色の一覧は空になる",
    );
  });

  it("context の取得は 1 度だけ行う", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const createContext = vi.fn(() => null);
    const isColorValue = createColorParser(createContext);

    isColorValue("#fff");
    isColorValue("#000");

    expect(createContext).toHaveBeenCalledTimes(1);
  });

  // import した時点で document を触ると、DOM の無い環境で読み込むだけで落ちる
  it("判定を呼ぶまで context を作らない", () => {
    const createContext = vi.fn(() => null);
    createColorParser(createContext);

    expect(createContext).not.toHaveBeenCalled();
  });
});
