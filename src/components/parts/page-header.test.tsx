import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectAbsent } from "@/test/absent";

import { PageHeader } from "./page-header";
import { CardPageTitle } from "./page-title";

/**
 * 状態のカタログは `page-header.stories.tsx` が持つ (ADR-0022)。ここに残すのは 2 種類ある。
 *
 * 60px の最小高と 12px の縦 padding、カードのページ見出しとの寸法一致は実測なので play へ
 * 移せない (節 5)。title が h1 であること、actions の有無で領域が出入りすることは、story に
 * play が無い以上ここでしか固定できない。とくに「出ない」ことは見た目のカタログでは
 * 表せない (節 7 の役割分担)。
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

    await expect.element(screen.getByText("追加")).toBeInTheDocument();
  });

  it("actions を渡さないとアクション領域が表示されない", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);

    // 肯定 anchor。描画が済んでいることを先に固定してから不在を見る (ADR-0029)
    await expect.element(screen.getByRole("heading", { name: "メモ一覧" })).toBeInTheDocument();
    await expectAbsent(screen.getByText("追加"));
  });

  it("actions の有無にかかわらず 60px の最小高と 12px の縦 padding になる", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);
    const header = screen.getByRole("banner");

    await expect.element(header).toHaveStyle("min-height: 60px");
    await expect.element(header).toHaveStyle("padding-top: 12px");
    await expect.element(header).toHaveStyle("padding-bottom: 12px");
  });

  // 器が違うので部品は分かれるが、どちらもページ見出しなので寸法は揃っていなければならない。
  // 別々に class を書いていた頃は、片方だけ変えても何も落ちずに 2 つの見出しがずれた
  it("カードのページ見出しと寸法が揃う", async () => {
    const screen = await render(
      <>
        <PageHeader title="ヘッダーの見出し" />
        <CardPageTitle>
          <h2>カードの見出し</h2>
        </CardPageTitle>
      </>,
    );

    const header = getComputedStyle(
      screen.getByRole("heading", { name: "ヘッダーの見出し" }).element(),
    );
    const card = getComputedStyle(
      screen.getByRole("heading", { name: "カードの見出し" }).element(),
    );

    expect(card.fontSize).toBe(header.fontSize);
    expect(card.fontWeight).toBe(header.fontWeight);
  });
});
