import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  restoreDefaultViewport,
  setViewport,
  SHORT_VIEWPORT,
  TABLET_VIEWPORT,
  expectWithinViewport,
} from "@/test/viewport";
import { waitForAnimations } from "@/test/wait-for-animations";

/**
 * 共有 DialogContent の viewport 溢れ backstop 回帰テスト。
 *
 * ブラウザテストには `@tailwindcss/vite` が入り `src/test/browser-setup.ts` が
 * `src/styles.css` を読むため、Tailwind のユーティリティクラスが実 CSS として解決される。
 * className の付与ではなく getBoundingClientRect / getComputedStyle による
 * 実挙動 (viewport 内収まり・スクロール到達) を検証する。
 *
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

  it("Tailwind が実 CSS に解決され、配置コンテナが fixed / popup が max-height を持つ", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();
    await waitForAnimations();

    const popup = screen.getByRole("dialog").element();
    const viewport = popup.parentElement;
    expect(viewport?.getAttribute("data-slot")).toBe("dialog-viewport");

    // popupViewportLayout の fixed / popupOverflowBackstop の max-h-full + overflow-y-auto が
    // クラス名ではなく実際の computed style として効いていること (以降の実測の前提条件)
    expect(getComputedStyle(viewport!).position).toBe("fixed");
    expect(getComputedStyle(popup).maxHeight).not.toBe("none");
    expect(getComputedStyle(popup).overflowY).toBe("auto");
  });

  it("基準 viewport で長身コンテンツでも popup 全体が viewport 内に収まる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();
    await waitForAnimations();

    expectWithinViewport(screen.getByRole("dialog").element());
  });

  it("popup 自身がスクロールして最下部コンテンツまで到達できる（backstop 挙動）", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();
    await waitForAnimations();

    const popup = screen.getByRole("dialog").element();
    // 内容が popup の表示領域を超えている = スクロールが必要な状態
    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);

    const marker = screen.getByText(BOTTOM_MARKER).element();
    const popupRect = popup.getBoundingClientRect();
    expect(marker.getBoundingClientRect().top).toBeGreaterThan(popupRect.bottom);

    popup.scrollTop = popup.scrollHeight;
    const scrolledPopupRect = popup.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    expect(markerRect.top).toBeGreaterThanOrEqual(scrolledPopupRect.top);
    expect(markerRect.bottom).toBeLessThanOrEqual(scrolledPopupRect.bottom);
  });

  it("極端に低い viewport でも popup 全体が viewport 内に収まる", async () => {
    await setViewport(SHORT_VIEWPORT);
    const screen = await renderTallDialog();
    await screen.getByText("開く").first().click();
    await waitForAnimations();

    const popup = screen.getByRole("dialog").element();
    expect(window.innerHeight).toBe(SHORT_VIEWPORT.height);
    expectWithinViewport(popup);
    // 低 viewport でもスクロールで最下部へ到達できる
    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);
  });

  it("vega既定の余白・幅・タイトル・フッター意匠を使う", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>視覚値確認</DialogTitle>
          <DialogFooter>操作</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    await waitForAnimations();

    const popup = screen.getByRole("dialog").element();
    const title = screen.getByText("視覚値確認").element();
    const footer = screen.getByText("操作").element();
    const close = screen.getByRole("button", { name: "Close" }).element();

    expect(getComputedStyle(popup).gap).toBe("24px");
    expect(getComputedStyle(popup).padding).toBe("24px");
    expect(getComputedStyle(popup).maxWidth).toBe("448px");
    expect(getComputedStyle(close).top).toBe("16px");
    expect(getComputedStyle(close).right).toBe("16px");
    expect(getComputedStyle(title).fontSize).toBe("14px");
    expect(getComputedStyle(footer).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(footer).borderTopWidth).toBe("0px");
  });
});
