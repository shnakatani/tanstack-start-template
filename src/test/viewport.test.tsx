import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { expectWithinViewport } from "@/test/viewport";

/** 辺ごとの判定は `viewport-overflows.test.ts` が持つ。ここは locator から矩形を読む配線だけを見る */
describe("expectWithinViewport", () => {
  it("viewport 内に収まる要素は通過する", async () => {
    const screen = await render(
      <div
        data-testid="box"
        style={{ position: "fixed", top: 10, left: 10, width: 50, height: 50 }}
      />,
    );

    await expectWithinViewport(screen.getByTestId("box"));
  });

  it("はみ出した辺が失敗文に出る", async () => {
    const screen = await render(
      <div
        data-testid="box"
        style={{ position: "fixed", top: window.innerHeight - 10, left: 10, width: 50, height: 50 }}
      />,
    );

    await expect(expectWithinViewport(screen.getByTestId("box"))).rejects.toThrow("bottom +40px");
  });

  it("要素が無ければ落ちる", async () => {
    await expect(expectWithinViewport(page.getByTestId("missing"))).rejects.toThrow(/missing/);
  });
});
