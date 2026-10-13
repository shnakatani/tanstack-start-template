import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { TableSkeleton } from "./table-skeleton";

/**
 * 状態のカタログは `table-skeleton.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは、
 * 支援技術に見せる形の契約と、列見出しの幅。表は列見出しを持つ table として露出し、本文は「読み込み中」の 1 行だけが読まれ、
 * skeleton の行は隠れる。列見出しの幅は本体の `DataTable` と同じく列の `size` で決まる。
 */
describe("TableSkeleton", () => {
  it("列見出しを持つ table として露出し、本文は読み込み中の 1 行だけを見せる", async () => {
    const screen = await render(
      <TableSkeleton
        caption="メモの一覧"
        columns={[
          { header: "タイトル", size: 200 },
          { header: "本文", size: 240 },
        ]}
        rows={3}
      />,
    );

    // 名前は本体の DataTable と同じ caption で付け、読み込み中から置き換わっても変わらない
    const table = screen.getByRole("table", { name: "メモの一覧" });
    await expect.element(table.getByRole("columnheader", { name: "タイトル" })).toBeInTheDocument();
    await expect.element(table.getByRole("columnheader", { name: "本文" })).toBeInTheDocument();
    await expect.element(table.getByRole("cell", { name: "読み込み中" })).toBeInTheDocument();
    // 見出しの行と読み込み中の行。skeleton の行 (rows) は aria-hidden で数に入らない
    await expect.element(table.getByRole("row")).toHaveLength(2);
  });

  // 本体の DataTable と同じく、列幅は列の size で決まる (ADR-0042)。列の合計より狭い器に入れて測る
  it("列見出しを列の size の幅で描く", async () => {
    const screen = await render(
      <div style={{ width: 160 }}>
        <TableSkeleton
          caption="メモの一覧"
          columns={[
            { header: "タイトル", size: 200 },
            { header: "本文", size: 120 },
          ]}
        />
      </div>,
    );

    await expect
      .poll(() =>
        screen
          .getByRole("columnheader")
          .elements()
          .map((header) => header.getBoundingClientRect().width),
      )
      .toEqual([200, 120]);
  });

  it("どの要素にも aria-busy を載せない", async () => {
    const screen = await render(
      <TableSkeleton caption="メモの一覧" columns={[{ header: "タイトル", size: 200 }]} />,
    );

    await expect.element(screen.getByRole("table")).toBeInTheDocument();
    await expect.poll(() => screen.container.querySelectorAll("[aria-busy]").length).toBe(0);
  });
});
