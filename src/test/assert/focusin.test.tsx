import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { recordFocusins } from "./focusin";

describe("recordFocusins", () => {
  it("呼んだ後に focusin を受けた要素を、受けた順に記録する", async () => {
    const screen = await render(
      <>
        <button type="button">前</button>
        <button type="button">後</button>
      </>,
    );
    const before = screen.getByRole("button", { name: "前" });
    const after = screen.getByRole("button", { name: "後" });
    await before.click();
    await expect.element(before).toHaveFocus();

    const focused = recordFocusins();
    await after.click();
    await before.click();
    await expect.element(before).toHaveFocus();

    expect(focused.map((target) => target.textContent)).toEqual(["後", "前"]);
  });
});
