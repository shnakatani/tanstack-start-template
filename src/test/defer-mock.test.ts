import { describe, expect, it, vi } from "vite-plus/test";

import { deferMock } from "./defer-mock";

describe("deferMock", () => {
  it("mock は元の実装ではなく、テストが決着させる Promise を返す", () => {
    const fn = vi.fn(() => Promise.resolve("元の実装"));

    const deferred = deferMock(fn);

    // 返る Promise が deferred のものなら、決着の時点はテストだけが握る
    expect(fn()).toBe(deferred.promise);
  });

  it("resolve を渡した値が mock の応答になる", async () => {
    const fn = vi.fn(() => Promise.resolve("元の実装"));
    const deferred = deferMock(fn);
    const pending = fn();

    deferred.resolve("テストが決める値");

    await expect(pending).resolves.toBe("テストが決める値");
  });

  it("reject を呼ぶと mock の Promise が reject する", async () => {
    const fn = vi.fn(() => Promise.resolve(undefined));
    const error = new Error("失敗");
    const deferred = deferMock(fn);
    const pending = fn();

    deferred.reject(error);

    await expect(pending).rejects.toBe(error);
  });
});
