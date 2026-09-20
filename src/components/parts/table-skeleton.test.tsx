import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { TableSkeleton } from "./table-skeleton";

function countSkeletons(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]').length;
}

/**
 * 状態のカタログは `table-skeleton.stories.tsx` が持つ (ADR-0022)。ここに残すのは構造の
 * 契約で、`columns × (rows + ヘッダー 1 行)` のセル数、`rows` 省略時の既定、table 要素で
 * あること、`role=status` である。
 *
 * この部品は args だけで状態が決まるので story に play を書かない (節 2)。story は
 * `columns: 4` の 1 本だけで件数も既定も見ないため、上の契約はここでしか固定できない
 * (節 7 の役割分担)。節 5 の「移せない 3 つ」には当たらない。
 */
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
