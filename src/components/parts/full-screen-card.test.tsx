import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { FullScreenCardTitle, FullScreenNotice } from "@/components/parts/full-screen-card";
import { CardTitle } from "@/components/ui/card";
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
    expect.assert(card !== null, "カードが見つからない");
    const rect = card.getBoundingClientRect();

    // FullScreenCard の p-6 = 24px
    expect(rect.left).toBe(24);
    expect(window.innerWidth - rect.right).toBe(24);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});

describe("FullScreenCardTitle", () => {
  it("tone=destructive は既定と違う色で描く", async () => {
    const screen = await render(
      <>
        <FullScreenCardTitle>
          <h1>既定の見出し</h1>
        </FullScreenCardTitle>
        <FullScreenCardTitle tone="destructive">
          <h2>破壊的な見出し</h2>
        </FullScreenCardTitle>
      </>,
    );

    const plain = screen.getByRole("heading", { name: "既定の見出し" }).element();
    const destructive = screen.getByRole("heading", { name: "破壊的な見出し" }).element();

    expect(getComputedStyle(plain).color).not.toBe(getComputedStyle(destructive).color);
  });

  it("registry のスタイル経路を保つため data-slot=card-title を残す", async () => {
    const screen = await render(
      <FullScreenCardTitle>
        <h1>見出し</h1>
      </FullScreenCardTitle>,
    );

    const heading = screen.getByRole("heading", { name: "見出し", level: 1 }).element();
    expect(heading.closest('[data-slot="card-title"]')).not.toBeNull();
  });

  // 寸法は Tailwind のスケール値 (18px / 600 等) を直接固定せず、styling.md の typography 階層が
  // 定める「ページ見出し > セクション見出し (registry 既定の CardTitle)」の大小関係で固定する
  it("registry 既定の CardTitle より大きく太い", async () => {
    const screen = await render(
      <>
        <CardTitle>
          <h2>registry の既定</h2>
        </CardTitle>
        <FullScreenCardTitle>
          <h2>ページの見出し</h2>
        </FullScreenCardTitle>
      </>,
    );

    const base = getComputedStyle(
      screen.getByRole("heading", { name: "registry の既定" }).element(),
    );
    const page = getComputedStyle(
      screen.getByRole("heading", { name: "ページの見出し" }).element(),
    );

    expect(parseFloat(page.fontSize)).toBeGreaterThan(parseFloat(base.fontSize));
    expect(Number(page.fontWeight)).toBeGreaterThan(Number(base.fontWeight));
  });
});
