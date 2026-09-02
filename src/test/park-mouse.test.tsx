import { afterEach, describe, expect, it } from "vite-plus/test";
import { cdp } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import { parkMouse } from "@/test/park-mouse";

const covers: Element[] = [];

afterEach(() => {
  for (const cover of covers.splice(0)) cover.remove();
});

describe("parkMouse", () => {
  it("viewport 全面を覆う要素の hover を解除する", async () => {
    const screen = await render(
      <div data-testid="hover-cover" style={{ position: "fixed", inset: 0 }} />,
    );
    const cover = screen.getByTestId("hover-cover").element();
    covers.push(cover);

    await cdp().send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    expect(cover.matches(":hover")).toBe(true);

    await parkMouse();

    expect(cover.matches(":hover")).toBe(false);
  });
});
