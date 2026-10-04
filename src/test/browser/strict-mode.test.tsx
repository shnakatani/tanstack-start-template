import { useEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { render, renderHook } from "vitest-browser-react";

function useMountLifecycle(lifecycle: string[]) {
  useEffect(() => {
    lifecycle.push("mount");
    return () => {
      lifecycle.push("unmount");
    };
  }, [lifecycle]);
}

describe("ブラウザテストの描画", () => {
  it("アプリと同じく StrictMode の下で描き、描画を 2 回走らせて mount 時の effect を付け直す", async () => {
    const onRender = vi.fn();
    const lifecycle: string[] = [];
    function Probe() {
      onRender();
      useMountLifecycle(lifecycle);
      return null;
    }

    await render(<Probe />);

    expect(onRender).toHaveBeenCalledTimes(2);
    expect(lifecycle).toEqual(["mount", "unmount", "mount"]);
  });

  it("renderHook も StrictMode の下で描き、mount 時の effect を付け直す", async () => {
    const lifecycle: string[] = [];

    await renderHook(() => {
      useMountLifecycle(lifecycle);
    });

    expect(lifecycle).toEqual(["mount", "unmount", "mount"]);
  });
});
