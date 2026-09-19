import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { CenteredCard, FullScreenNotice } from "@/components/parts/centered-card";
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

  // 見出しは CardTitle 内の h1 として組む (card.tsx は無改変。詳細は centered-card.tsx)
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

    // CenteredCard の p-6 = 24px
    expect(rect.left).toBe(24);
    expect(window.innerWidth - rect.right).toBe(24);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});

describe("CenteredCard", () => {
  // カード幅は fill によらず max-w-sm (24rem)。fill ごとに器を手で組んでいた頃は、片方の幅を
  // 変えてももう片方が旧幅のまま残り、layout class なので no-restyle でも見えなかった
  it("fill によらずカードの幅が max-w-sm に収まる", async () => {
    const screen = await render(
      <>
        <CenteredCard>
          <p>画面全体</p>
        </CenteredCard>
        <CenteredCard fill="section">
          <p>画面の一部</p>
        </CenteredCard>
      </>,
    );

    const cardOf = (text: string) => {
      const card = screen.getByText(text).element().closest('[data-slot="card"]');
      expect.assert(card !== null, `${text} のカードが見つからない`);
      return card.getBoundingClientRect().width;
    };

    expect(cardOf("画面全体")).toBe(384);
    expect(cardOf("画面の一部")).toBe(384);
  });

  it("fill で占める高さが変わる", async () => {
    const screen = await render(
      <CenteredCard fill="section">
        <p>画面の一部</p>
      </CenteredCard>,
    );

    const frame = screen
      .getByText("画面の一部")
      .element()
      .closest('[data-slot="card"]')?.parentElement;
    expect.assert(frame != null, "外枠が見つからない");

    // min-h-[50vh] は viewport 高の半分。screen (min-h-svh) と取り違えると全画面を占める
    expect(getComputedStyle(frame).minHeight).toBe(`${window.innerHeight / 2}px`);
  });
});
