import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { isColor } from "./css-color.story-helpers";

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
