import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  // ページの見出しなので h1。h2 だと画面に h1 が 1 つも無い状態になり、
  // 見出しジャンプで移動する支援技術がページの主題に辿り着けない
  it("title をページの h1 として描画する", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);

    expect(screen.getByRole("heading", { name: "メモ一覧", level: 1 }).query()).not.toBeNull();
  });

  it("actions を渡すとボタンが表示される", async () => {
    const screen = await render(
      <PageHeader title="メモ一覧" actions={<button type="button">追加</button>} />,
    );

    expect(screen.getByText("追加").query()).not.toBeNull();
  });

  it("actions を渡さないとアクション領域が表示されない", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);

    expect(screen.getByText("追加").query()).toBeNull();
  });

  it("actions の有無にかかわらず 60px の最小高と 12px の縦 padding になる", async () => {
    const screen = await render(<PageHeader title="メモ一覧" />);
    const header = screen.getByRole("banner").element();
    const style = getComputedStyle(header);

    expect(style.minHeight).toBe("60px");
    expect(style.paddingTop).toBe("12px");
    expect(style.paddingBottom).toBe("12px");
  });
});
