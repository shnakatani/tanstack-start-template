import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { TableSkeleton } from "./table-skeleton";

/**
 * 状態のカタログは `table-skeleton.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは、
 * 支援技術に見せる形の契約だけ。表は列見出しを持つ table として露出し、本文は「読み込み中」の 1 行だけが読まれ、
 * skeleton の行は隠れる。
 */
describe("TableSkeleton", () => {
  it("列見出しを持つ table として露出し、本文は読み込み中の 1 行だけを見せる", async () => {
    const screen = await render(
      <TableSkeleton caption="メモの一覧" headers={["タイトル", "本文"]} rows={3} />,
    );

    // 名前は本体の DataTable と同じ caption で付け、読み込み中から置き換わっても変わらない
    const table = screen.getByRole("table", { name: "メモの一覧" });
    await expect.element(table.getByRole("columnheader", { name: "タイトル" })).toBeInTheDocument();
    await expect.element(table.getByRole("columnheader", { name: "本文" })).toBeInTheDocument();
    await expect.element(table.getByRole("cell", { name: "読み込み中" })).toBeInTheDocument();
    // 見出しの行と読み込み中の行。skeleton の行 (rows) は aria-hidden で数に入らない
    await expect.element(table.getByRole("row")).toHaveLength(2);
  });

  it("どの要素にも aria-busy を載せない", async () => {
    const screen = await render(<TableSkeleton caption="メモの一覧" headers={["タイトル"]} />);

    await expect.element(screen.getByRole("table")).toBeInTheDocument();
    await expect.poll(() => screen.container.querySelectorAll("[aria-busy]").length).toBe(0);
  });
});
