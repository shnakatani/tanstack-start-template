import { describe, expect, it } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * Indicator の中で実際に見えているアイコンを全て返す。1 つ目で打ち切ると、
 * 両方が同時に見える壊れ方 (片側の `hidden` だけが落ちた状態) を見逃す。
 *
 * 見えているかの判定に `getComputedStyle` が要り、対応する locator の matcher が無い。
 * 同期読みはこの helper の中で閉じ、呼び出し側は locator を渡す (ADR-0029)
 */
function visibleIconNames(checkbox: Locator): (string | null)[] {
  return [...checkbox.element().querySelectorAll('[data-slot="checkbox-indicator"] > svg')]
    .filter((icon) => getComputedStyle(icon).display !== "none")
    .map((icon) => icon.getAttribute("class")?.match(/lucide-([a-z-]+)/)?.[1] ?? null);
}

describe("Checkbox", () => {
  // registry はチェックマークしか持たず、base-ui が checked と indeterminate の
  // どちらでも Indicator を描くため、素のままだと両者が同じ絵になる
  // (shadcn-ui/ui#9357、ADR-0006 の乖離)
  it("checked ではチェックマークを出す", async () => {
    const screen = await render(<Checkbox defaultChecked aria-label="選択" />);

    expect(visibleIconNames(screen.getByRole("checkbox"))).toEqual(["check"]);
  });

  it("indeterminate では checked と別のアイコンを出す", async () => {
    const screen = await render(<Checkbox indeterminate aria-label="一部選択" />);

    expect(visibleIconNames(screen.getByRole("checkbox"))).toEqual(["minus"]);
  });
});
