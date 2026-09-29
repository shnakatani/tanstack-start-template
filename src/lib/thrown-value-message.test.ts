import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { THROWN_VALUE_UNPRINTABLE, thrownValueMessage } from "./thrown-value-message";

describe("thrownValueMessage", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("Error はその message を返す", () => {
    expect(thrownValueMessage(new Error("取得に失敗しました"))).toBe("取得に失敗しました");
  });

  it("Error でない値は文字列にして返す", () => {
    expect(thrownValueMessage("中断されました")).toBe("中断されました");
    expect(thrownValueMessage(404)).toBe("404");
    expect(thrownValueMessage(undefined)).toBe("undefined");
    expect(thrownValueMessage(null)).toBe("null");
  });

  it("文字列にできない値は固定の文言を返し、元の値を warn に残す", () => {
    const value: unknown = Object.create(null);

    expect(thrownValueMessage(value)).toBe(THROWN_VALUE_UNPRINTABLE);
    expect(warnSpy).toHaveBeenCalledWith("[thrownValueMessage] 文字列にできない値", { value });
  });
});
