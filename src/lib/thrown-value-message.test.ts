import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  THROWN_VALUE_UNPRINTABLE,
  thrownValueMessage,
  thrownValueStack,
} from "./thrown-value-message";

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

  // 空の message や文字列でない message をそのまま返すと、画面が空になるか React の描画が落ちる
  it("message が空か文字列でない Error は、値を文字列にして返す", () => {
    expect(thrownValueMessage(new Error(""))).toBe("Error");
    expect(thrownValueMessage(Object.assign(new Error(), { message: { code: 1 } }))).toBe(
      "Error: [object Object]",
    );
  });

  // Error でない値は、message を持っていても読まずに文字列にする (Router の data-loading ガイドの例と同じ)
  it("Error でない値は文字列にして返す", () => {
    expect(thrownValueMessage("中断されました")).toBe("中断されました");
    expect(thrownValueMessage(404)).toBe("404");
    expect(thrownValueMessage(undefined)).toBe("undefined");
    expect(thrownValueMessage(null)).toBe("null");
    expect(thrownValueMessage({ message: "取得に失敗しました" })).toBe("[object Object]");
  });

  it("文字列にできない値は固定の文言を返し、元の値を warn に残す", () => {
    const value: unknown = Object.create(null);

    expect(thrownValueMessage(value)).toBe(THROWN_VALUE_UNPRINTABLE);
    expect(warnSpy).toHaveBeenCalledWith("[thrownValueMessage] 文字列にできない値", { value });
  });

  it("message の読み取りが throw する Error も固定の文言を返す", () => {
    class UnreadableError extends Error {
      override get message(): string {
        throw new Error("読み取れない");
      }
    }
    const value = new UnreadableError();

    expect(thrownValueMessage(value)).toBe(THROWN_VALUE_UNPRINTABLE);
    expect(warnSpy).toHaveBeenCalledWith("[thrownValueMessage] 文字列にできない値", { value });
  });

  it("instanceof の判定が throw する値も固定の文言を返す", () => {
    const value = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("参照できない");
        },
      },
    );

    expect(thrownValueMessage(value)).toBe(THROWN_VALUE_UNPRINTABLE);
    // 引数の比較は vitest の等価判定が prototype を参照して落ちるので、呼ばれたことだけを見る
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

describe("thrownValueStack", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("Error はその stack を返す", () => {
    const error = new Error("取得に失敗しました");

    expect(thrownValueStack(error)).toBe(error.stack);
  });

  it("Error でない値と、stack が文字列でない Error は undefined を返す", () => {
    expect(thrownValueStack({ stack: "at x" })).toBeUndefined();
    expect(thrownValueStack(Object.assign(new Error(), { stack: undefined }))).toBeUndefined();
  });

  it("stack の読み取りが throw する Error は undefined を返し、元の値を warn に残す", () => {
    // V8 は stack を instance の own property に置くので、prototype の getter では上書きできない
    const value = Object.defineProperty(new Error(), "stack", {
      get() {
        throw new Error("読み取れない");
      },
    });

    expect(thrownValueStack(value)).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[thrownValueStack] stack を読めない値", { value });
  });

  it("instanceof の判定が throw する値も undefined を返す", () => {
    const value = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("参照できない");
        },
      },
    );

    expect(thrownValueStack(value)).toBeUndefined();
    // 引数の比較は vitest の等価判定が prototype を参照して落ちるので、呼ばれたことだけを見る
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
