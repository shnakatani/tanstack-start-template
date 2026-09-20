import { describe, expect, it, vi } from "vite-plus/test";

import { createThemeSnapshotStore } from "./theme-snapshot.story-helpers";

function element(className: string): Element {
  const created = document.createElement("div");
  created.className = className;
  return created;
}

describe("createThemeSnapshotStore", () => {
  it("同じテーマの間は同じ参照を返す", () => {
    const node = element("light");
    const store = createThemeSnapshotStore(
      () => ({ read: true }),
      { read: false },
      () => node,
    );

    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("テーマが変わると読み直す", () => {
    const node = element("light");
    const read = vi.fn(() => node.className);
    const store = createThemeSnapshotStore(read, "", () => node);

    expect(store.getSnapshot()).toBe("light");
    node.className = "dark";
    expect(store.getSnapshot()).toBe("dark");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("テーマが戻ったら読み直す (キャッシュは 1 つだけ持つ)", () => {
    const node = element("light");
    const read = vi.fn(() => node.className);
    const store = createThemeSnapshotStore(read, "", () => node);

    store.getSnapshot();
    node.className = "dark";
    store.getSnapshot();
    node.className = "light";

    expect(store.getSnapshot()).toBe("light");
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("class の変化を購読し、解除できる", async () => {
    const node = element("");
    const store = createThemeSnapshotStore(
      () => 1,
      0,
      () => node,
    );
    const onChange = vi.fn();

    const unsubscribe = store.subscribe(onChange);
    node.className = "dark";
    // MutationObserver の通知は microtask で届く
    await Promise.resolve();
    expect(onChange).toHaveBeenCalled();

    unsubscribe();
    node.className = "light";
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("CSS の HMR を受けたら、テーマが同じでも読み直す", () => {
    const node = element("light");
    const read = vi.fn(() => ({ read: true }));
    const listeners = new Set<() => void>();
    const hot = {
      on: (_event: "vite:afterUpdate", callback: () => void) => void listeners.add(callback),
      off: (_event: "vite:afterUpdate", callback: () => void) => void listeners.delete(callback),
    };
    const store = createThemeSnapshotStore(read, { read: false }, () => node, hot);

    store.subscribe(vi.fn());
    const before = store.getSnapshot();
    // stylesheet だけが差し替わる。class は動かない
    for (const callback of listeners) callback();

    expect(store.getSnapshot()).not.toBe(before);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("購読者が複数でも、1 回の変更につき読み直しは 1 回", () => {
    const node = element("light");
    const read = vi.fn(() => ({ read: true }));
    const listeners = new Set<() => void>();
    const hot = {
      on: (_event: "vite:afterUpdate", callback: () => void) => void listeners.add(callback),
      off: (_event: "vite:afterUpdate", callback: () => void) => void listeners.delete(callback),
    };
    const store = createThemeSnapshotStore(read, { read: false }, () => node, hot);

    // React は購読者ごとに別の onChange を渡し、そのあと getSnapshot を呼ぶ。
    // 同じ関数を 2 回渡すと Set が重複を落とし、購読者が 1 件しか作られない
    store.subscribe(() => void store.getSnapshot());
    store.subscribe(() => void store.getSnapshot());
    store.getSnapshot();
    expect(read).toHaveBeenCalledTimes(1);

    for (const callback of listeners) callback();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it("購読を解除すると HMR の listener も外れる", () => {
    const node = element("light");
    const listeners = new Set<() => void>();
    const hot = {
      on: (_event: "vite:afterUpdate", callback: () => void) => void listeners.add(callback),
      off: (_event: "vite:afterUpdate", callback: () => void) => void listeners.delete(callback),
    };
    const store = createThemeSnapshotStore(
      () => 1,
      0,
      () => node,
      hot,
    );

    const unsubscribe = store.subscribe(vi.fn());
    expect(listeners.size).toBe(1);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("同じ関数を 2 回購読しても観測は 1 つだけ", () => {
    const node = element("light");
    // Set だと二重登録が見えないので配列で受ける
    const registered: Array<() => void> = [];
    const hot = {
      on: (_event: "vite:afterUpdate", callback: () => void) => void registered.push(callback),
      off: (_event: "vite:afterUpdate", callback: () => void) => {
        const at = registered.indexOf(callback);
        if (at >= 0) registered.splice(at, 1);
      },
    };
    const store = createThemeSnapshotStore(
      () => 1,
      0,
      () => node,
      hot,
    );
    const onChange = vi.fn();

    const first = store.subscribe(onChange);
    const second = store.subscribe(onChange);

    expect(registered).toHaveLength(1);

    first();
    second();

    expect(registered).toHaveLength(0);
  });

  it("描画前は fallback を返す", () => {
    const store = createThemeSnapshotStore(
      () => ["read"],
      [],
      () => element(""),
    );

    expect(store.getServerSnapshot()).toEqual([]);
  });
});
