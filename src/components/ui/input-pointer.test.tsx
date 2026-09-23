import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Input } from "./input";

/**
 * pointer が input 本体に届くことを見る。Playwright の click は hit-target の検査を通すので、
 * 重なる要素や疑似要素が pointer を奪えば click 自体が落ちる (ADR-0034)。
 * `type="number"` の spinner は NumberField を採る決定 (ADR-0025) により対象外。
 */
describe("Input の pointer の到達", () => {
  it("Input は視覚領域の中央で input 本体が pointer を受ける", async () => {
    const screen = await render(
      <div className="w-40 p-8">
        <Input aria-label="氏名" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "氏名" });

    await input.click();
    await expect.element(input).toHaveFocus();
  });
});
