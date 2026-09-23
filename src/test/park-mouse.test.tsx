import { describe, expect, it } from "vite-plus/test";
import { cdp } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import { parkMouse } from "@/test/park-mouse";

describe("parkMouse", () => {
  it("viewport 全面を覆う要素の hover を解除する", async () => {
    // 描画した要素の後始末は vitest-browser-react の自動 cleanup に任せる (次のテストの前に消える)
    const screen = await render(
      <div data-testid="hover-cover" style={{ position: "fixed", inset: 0 }} />,
    );
    const cover = screen.getByTestId("hover-cover");
    // `:hover` を見る matcher は無いので、poll の中で要素を引き直して読む (ADR-0043)
    const hovered = () => cover.element().matches(":hover");

    await cdp().send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    await expect.poll(hovered).toBe(true);

    await parkMouse();

    await expect.poll(hovered).toBe(false);
  });
});
