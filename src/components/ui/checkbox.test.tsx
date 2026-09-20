import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Checkbox } from "@/components/ui/checkbox";

/** Indicator の中で実際に見えているアイコンの lucide クラスを返す */
function visibleIconName(root: Element): string | null {
  const icons = root.querySelectorAll('[data-slot="checkbox-indicator"] > svg');
  for (const icon of icons) {
    if (getComputedStyle(icon).display !== "none") {
      return icon.getAttribute("class")?.match(/lucide-([a-z-]+)/)?.[1] ?? null;
    }
  }
  return null;
}

describe("Checkbox", () => {
  // registry はチェックマークしか持たず、base-ui が checked と indeterminate の
  // どちらでも Indicator を描くため、素のままだと両者が同じ絵になる
  // (shadcn-ui/ui#9357、ADR-0006 の乖離)
  it("checked ではチェックマークを出す", async () => {
    const screen = await render(<Checkbox defaultChecked aria-label="選択" />);

    expect(visibleIconName(screen.getByRole("checkbox").element())).toBe("check");
  });

  it("indeterminate では checked と別のアイコンを出す", async () => {
    const screen = await render(<Checkbox indeterminate aria-label="一部選択" />);

    expect(visibleIconName(screen.getByRole("checkbox").element())).toBe("minus");
  });
});
