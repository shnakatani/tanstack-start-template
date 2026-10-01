import { useEffect } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

describe("ブラウザテストの描画", () => {
  it("アプリと同じく StrictMode の下で描き、mount 時の effect を付け直す", async () => {
    const lifecycle: string[] = [];
    function Probe() {
      useEffect(() => {
        lifecycle.push("mount");
        return () => {
          lifecycle.push("unmount");
        };
      }, []);
      return null;
    }

    await render(<Probe />);

    // StrictMode は開発時に mount 直後の effect を 1 度外して付け直す (React docs「StrictMode」)
    expect(lifecycle).toEqual(["mount", "unmount", "mount"]);
  });
});
