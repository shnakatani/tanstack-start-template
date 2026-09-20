import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createSettlingAction } from "./settling-action";

/** Promise が決着したかを同期に読める形にする */
function track(promise: Promise<unknown>): { settled: () => boolean } {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  return { settled: () => settled };
}

afterEach(() => vi.restoreAllMocks());

describe("createSettlingAction", () => {
  it("impl は呼ぶたびに未決着の Promise を返す", async () => {
    const settling = createSettlingAction();
    const first = track(settling.impl());
    const second = track(settling.impl());

    await Promise.resolve();
    expect(first.settled()).toBe(false);
    expect(second.settled()).toBe(false);
  });

  it("settle は未決着のものを全て決着させる", async () => {
    const settling = createSettlingAction();
    const first = track(settling.impl());
    const second = track(settling.impl());

    settling.settle();
    await Promise.resolve();

    expect(first.settled()).toBe(true);
    expect(second.settled()).toBe(true);
  });

  it("settle のあとに作った Promise は次の settle まで決着しない", async () => {
    const settling = createSettlingAction();
    void settling.impl();
    settling.settle();

    const later = track(settling.impl());
    await Promise.resolve();
    expect(later.settled()).toBe(false);

    settling.settle();
    await Promise.resolve();
    expect(later.settled()).toBe(true);
  });

  it("settle を 2 回呼んでも落ちない (決着済みを持ち越さない)", () => {
    const settling = createSettlingAction();
    void settling.impl();
    settling.settle();

    expect(() => {
      settling.settle();
    }).not.toThrow();
  });

  it("beforeEach は持ち越しを決着させてから始め、warn を残す", async () => {
    const settling = createSettlingAction();
    const leaked = track(settling.impl());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 次の描画の開始。前の分を捨てると、それを待つ Transition が永久に pending になる
    const teardown = settling.beforeEach();
    await Promise.resolve();

    expect(leaked.settled()).toBe(true);
    expect(warn).toHaveBeenCalledOnce();

    const current = track(settling.impl());
    teardown();
    await Promise.resolve();

    expect(current.settled()).toBe(true);
  });
});
