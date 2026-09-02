import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { FullScreenNotice } from "@/components/full-screen-card";
import { NARROW_VIEWPORT, restoreDefaultViewport, setViewport } from "@/test/viewport";

async function renderNotice() {
  return await render(
    <FullScreenNotice title="通知の見出し" description="通知の説明文">
      <button type="button">操作</button>
    </FullScreenNotice>,
  );
}

describe("FullScreenNotice", () => {
  afterEach(restoreDefaultViewport);

  // 見出しは CardTitle 内の h1 として組む (card.tsx は無改変。詳細は full-screen-card.tsx)
  it("見出しを h1 として描画し、説明と操作を伴う", async () => {
    const screen = await renderNotice();

    expect(screen.getByRole("heading", { name: "通知の見出し", level: 1 }).query()).not.toBeNull();
    expect(screen.getByText("通知の説明文").query()).not.toBeNull();
    expect(screen.getByRole("button", { name: "操作" }).query()).not.toBeNull();
  });

  it("見出しに data-slot=card-title を保つ (registry のスタイルが当たる経路を残す)", async () => {
    const screen = await renderNotice();

    const heading = screen.getByRole("heading", { name: "通知の見出し", level: 1 }).element();
    expect(heading.closest('[data-slot="card-title"]')).not.toBeNull();
  });

  it("375px 幅でもカードが画面端に接しない", async () => {
    await setViewport(NARROW_VIEWPORT);
    const screen = await renderNotice();

    const card = screen.getByText("通知の見出し").element().closest('[data-slot="card"]');
    if (card === null) throw new Error("カードが見つからない");
    const rect = card.getBoundingClientRect();

    // FullScreenCard の p-6 = 24px
    expect(rect.left).toBe(24);
    expect(window.innerWidth - rect.right).toBe(24);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
