import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectAbsent } from "@/test/absent";
import { expectText } from "@/test/page-helpers";

import { PageHeader } from "./page-header";

/**
 * 状態のカタログは `page-header.stories.tsx` が持つ (ADR-0044)。ここに残すのは、title が h1 で
 * あること、actions の有無で領域が出入りすること、帯の寸法で、story に play が無い以上ここで
 * しか固定できない。とくに「出ない」ことは見た目のカタログでは表せない (ADR-0044 の役割分担)。
 *
 * カードのページ見出しとの寸法一致は測らない。どちらも同じ `pageTitle` (`page-title.tsx`) を
 * 当てる 1 つの出処で、外見の上書きは層の規則が止める (ADR-0013)。
 */
describe("PageHeader", () => {
  // ページの見出しなので h1。h2 だと画面に h1 が 1 つも無い状態になり、
  // 見出しジャンプで移動する支援技術がページの主題に辿り着けない
  it("title をページの h1 として描画する", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);

    await expect
      .element(screen.getByRole("heading", { name: "メモ一覧", level: 1 }))
      .toBeInTheDocument();
  });

  it("actions を渡すとボタンが表示される", async () => {
    const screen = await render(
      <PageHeader title="メモ一覧" actions={<button type="button">追加</button>} />,
    );

    await expectText(screen, "追加");
  });

  it("actions を渡さないとアクション領域が表示されない", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);

    // 肯定 anchor。描画が済んでいることを先に固定してから不在を見る (ADR-0041)
    await expect.element(screen.getByRole("heading", { name: "メモ一覧" })).toBeInTheDocument();
    await expectAbsent(screen.getByText("追加"));
  });

  it("actions の有無にかかわらず 60px の最小高と 12px の縦 padding になる", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);
    const header = screen.getByRole("banner");

    await expect
      .element(header)
      .toHaveStyle("min-height: 60px; padding-top: 12px; padding-bottom: 12px");
  });
});
