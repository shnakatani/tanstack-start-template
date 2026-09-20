import { describe, expect, it } from "vite-plus/test";

import { createSettlingAction } from "./settling-action";

/** Promise が決着したかを同期に読める形にする */
function track(promise: Promise<unknown>): { settled: () => boolean } {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  return { settled: () => settled };
}

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

  it("beforeEach が返す teardown は、その story で作った分だけを決着させる", async () => {
    const settling = createSettlingAction();
    const leaked = track(settling.impl());

    // 次の story の開始。前の story の持ち越しは捨てる
    const teardown = settling.beforeEach();
    const current = track(settling.impl());

    teardown();
    await Promise.resolve();

    expect(current.settled()).toBe(true);
    expect(leaked.settled()).toBe(false);
  });
});
