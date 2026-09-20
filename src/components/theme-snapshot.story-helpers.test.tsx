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

  it("描画前は fallback を返す", () => {
    const store = createThemeSnapshotStore(
      () => ["read"],
      [],
      () => element(""),
    );

    expect(store.getServerSnapshot()).toEqual([]);
  });
});
