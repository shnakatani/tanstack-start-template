import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * registry 乖離のガード。registry はチェックマークしか持たず、base-ui が checked と
 * indeterminate のどちらでも Indicator を描くため、素のままだと両者が同じ絵になる
 * (shadcn-ui/ui#9357、ADR-0024)。見えているアイコンを両方について見る。片側だけ見ると、
 * 両方が同時に見える壊れ方 (片側の `hidden` だけが落ちた状態) を見逃す。
 */
describe("Checkbox", () => {
  it("checked ではチェックマークだけを出す", async () => {
    const screen = await render(<Checkbox defaultChecked aria-label="選択" />);
    const checkbox = screen.getByRole("checkbox");

    await expect.element(checkbox.getByIcon("check")).toBeVisible();
    await expect.element(checkbox.getByIcon("minus")).not.toBeVisible();
  });

  it("indeterminate では横棒だけを出す", async () => {
    const screen = await render(<Checkbox indeterminate aria-label="一部選択" />);
    const checkbox = screen.getByRole("checkbox");

    await expect.element(checkbox.getByIcon("minus")).toBeVisible();
    await expect.element(checkbox.getByIcon("check")).not.toBeVisible();
  });
});
