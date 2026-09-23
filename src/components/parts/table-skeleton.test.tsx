import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { TableSkeleton } from "./table-skeleton";

/**
 * 状態のカタログは `table-skeleton.stories.tsx` が持つ (ADR-0039)。ここに残すのは、
 * 読み込み中であることを支援技術に伝える契約 (`role="status"` + `aria-label`) だけ。
 *
 * セルの数は数えない。`columns × (rows + 1)` は部品の `Array.from` そのものの算術で、
 * 数えても source を言い直すだけになる。列数が実テーブルと揃うことは消費側が列定義を
 * SSOT にして担う (別々に持つとロード完了時にレイアウトがずれる)。
 */
describe("TableSkeleton", () => {
  it("読み込み中であることを status として通知する", async () => {
    const screen = await render(<TableSkeleton columns={2} />);

    await expect
      .element(screen.getByRole("status", { name: "読み込み中" }))
      .toHaveAttribute("aria-busy", "true");
  });
});
