import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { TableSkeleton } from "./table-skeleton";

function countSkeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]').length;
}

describe("TableSkeleton", () => {
  it("columns × (rows + ヘッダー 1 行) 分の skeleton セルが表示される", async () => {
    const screen = await render(<TableSkeleton columns={3} rows={2} />);

    // ヘッダー 3 + ボディ 3×2 = 9
    expect(countSkeletons(screen.container)).toBe(9);
  });

  it("rows 省略時は 3 行で表示される", async () => {
    const screen = await render(<TableSkeleton columns={2} />);

    // ヘッダー 2 + ボディ 2×3 = 8
    expect(countSkeletons(screen.container)).toBe(8);
  });

  it("table 要素として描画される", async () => {
    const screen = await render(<TableSkeleton columns={2} />);

    expect(screen.container.querySelector("table")).not.toBeNull();
  });

  it('role="status" でローディング中であることが通知される', async () => {
    const screen = await render(<TableSkeleton columns={2} />);

    expect(screen.getByRole("status").query()).not.toBeNull();
  });
});
