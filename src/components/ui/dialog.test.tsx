import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  expectWithinViewport,
  restoreDefaultViewport,
  setViewport,
  SHORT_VIEWPORT,
  TABLET_VIEWPORT,
} from "@/test/viewport";

/**
 * 共有 DialogContent の viewport 溢れ backstop。registry 乖離 (Viewport + `popupOverflowBackstop`
 * + Popup の flex-col。ADR-0006 の許容リスト) のガードで、`registry-baseline.test.ts` は
 * baseline の存在しか見ず乖離が消えても落ちないことを実測した (2026-09-22)。
 *
 * 到達性は実キーボードで見る (Popup は開いたとき focus を受け、End で末尾へスクロールする)。
 * 溢れコンテンツは `height` ではなく `minHeight` で作る: DialogContent は flex column で、
 * flex item は既定で縮むため `height: 3000px` の子は popup 高に潰れて溢れを再現できない。
 */

const BOTTOM_MARKER = "末尾コンテンツ";

function renderTallDialog() {
  return render(
    <Dialog>
      <DialogTrigger render={<Button>開く</Button>} />
      <DialogContent>
        <DialogTitle>長いダイアログ</DialogTitle>
        <div style={{ minHeight: "3000px" }}>先頭コンテンツ</div>
        <p>{BOTTOM_MARKER}</p>
      </DialogContent>
    </Dialog>,
  );
}

describe("DialogContent（viewport 溢れ backstop）", () => {
  afterEach(restoreDefaultViewport);

  it("配置コンテナが fixed で、Popup はその中で flex-col に組まれる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();

    const viewport = screen.getBySlot("dialog-viewport");
    await expect.element(viewport).toHaveStyle("position: fixed");
    await expect
      .element(viewport.getByRole("dialog"))
      .toHaveStyle("overflow-y: auto; display: flex; flex-direction: column");
  });

  it("基準 viewport で長身コンテンツでも popup 全体が viewport 内に収まる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();

    const popup = screen.getByRole("dialog");
    await expect.element(popup).toBeInTheDocument();
    await expectWithinViewport(popup);
  });

  it("キーボードで最下部コンテンツまで到達できる（backstop 挙動）", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();
    const marker = screen.getByText(BOTTOM_MARKER);

    await expect.element(screen.getByText("先頭コンテンツ")).toBeInViewport();
    await expect.element(marker).not.toBeInViewport();

    await userEvent.keyboard("{End}");

    await expect.element(marker).toBeInViewport();
  });

  it("極端に低い viewport でも popup 全体が viewport 内に収まり、最下部へ到達できる", async () => {
    await setViewport(SHORT_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();

    const popup = screen.getByRole("dialog");
    await expect.element(popup).toBeInTheDocument();
    expect(window.innerHeight).toBe(SHORT_VIEWPORT.height);
    await expectWithinViewport(popup);

    await userEvent.keyboard("{End}");
    await expect.element(screen.getByText(BOTTOM_MARKER)).toBeInViewport();
  });
});
