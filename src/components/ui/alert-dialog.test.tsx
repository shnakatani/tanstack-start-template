import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  restoreDefaultViewport,
  setViewport,
  TABLET_VIEWPORT,
  expectWithinViewport,
} from "@/test/viewport";
import { waitForAnimations } from "@/test/wait-for-animations";

/**
 * AlertDialogContent の viewport 溢れ backstop 回帰テスト。
 * Dialog と共通の popupOverflowBackstop (dialog.tsx) が適用されていることを守る。
 * Tailwind はブラウザテストでも実 CSS に解決されるため、className ではなく実挙動
 * (viewport 内収まり・スクロール到達) で検証する
 * (前提と溢れコンテンツの作り方は dialog.test.tsx の冒頭コメントを参照)。
 */

const BOTTOM_MARKER = "末尾コンテンツ";

function renderTallAlertDialog() {
  return render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>確認</AlertDialogTitle>
        <AlertDialogDescription>長い内容でも見切れない</AlertDialogDescription>
        <div style={{ minHeight: "3000px" }}>先頭コンテンツ</div>
        <p>{BOTTOM_MARKER}</p>
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe("AlertDialogContent（viewport 溢れ backstop）", () => {
  afterEach(restoreDefaultViewport);

  it("長身コンテンツでも popup 全体が viewport 内に収まる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();

    const popup = await screen.getByRole("alertdialog").findElement();
    await waitForAnimations();

    // base-ui 公式 anatomy: Popup は Viewport (配置コンテナ) の中に置く
    expect(popup.parentElement?.getAttribute("data-slot")).toBe("alert-dialog-viewport");

    expectWithinViewport(popup);
  });

  it("popup 自身がスクロールして最下部コンテンツまで到達できる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();

    const popup = await screen.getByRole("alertdialog").findElement();
    await waitForAnimations();

    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);

    const marker = await screen.getByText(BOTTOM_MARKER).findElement();
    expect(marker.getBoundingClientRect().top).toBeGreaterThan(
      popup.getBoundingClientRect().bottom,
    );

    popup.scrollTop = popup.scrollHeight;
    const popupRect = popup.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    expect(markerRect.top).toBeGreaterThanOrEqual(popupRect.top);
    expect(markerRect.bottom).toBeLessThanOrEqual(popupRect.bottom);
  });

  // display / flex-direction は viewport に依存しないため、寸法系の前処理は置かない
  it("Popup が flex-col 構造を持つ (ADR-0006 の乖離)", async () => {
    const screen = await render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>構造確認</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const popup = await screen.getByRole("alertdialog").findElement();
    await waitForAnimations();

    expect(getComputedStyle(popup).display).toBe("flex");
    expect(getComputedStyle(popup).flexDirection).toBe("column");
  });
});
