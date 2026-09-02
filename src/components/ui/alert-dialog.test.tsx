import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
    await waitForAnimations();

    const popup = screen.getByRole("alertdialog").element();
    // base-ui 公式 anatomy: Popup は Viewport (配置コンテナ) の中に置く
    expect(popup.parentElement?.getAttribute("data-slot")).toBe("alert-dialog-viewport");

    expectWithinViewport(popup);
  });

  it("popup 自身がスクロールして最下部コンテンツまで到達できる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();
    await waitForAnimations();

    const popup = screen.getByRole("alertdialog").element();
    expect(popup.scrollHeight).toBeGreaterThan(popup.clientHeight);

    const marker = screen.getByText(BOTTOM_MARKER).element();
    expect(marker.getBoundingClientRect().top).toBeGreaterThan(
      popup.getBoundingClientRect().bottom,
    );

    popup.scrollTop = popup.scrollHeight;
    const popupRect = popup.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    expect(markerRect.top).toBeGreaterThanOrEqual(popupRect.top);
    expect(markerRect.bottom).toBeLessThanOrEqual(popupRect.bottom);
  });

  it("vega既定の余白・幅・media・タイトル・フッター意匠を使う", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <svg aria-label="警告アイコン" />
            </AlertDialogMedia>
            <AlertDialogTitle>視覚値確認</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>操作</AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await waitForAnimations();

    const popup = screen.getByRole("alertdialog").element();
    const icon = screen.getByLabelText("警告アイコン").element();
    const media = icon.closest('[data-slot="alert-dialog-media"]');
    const title = screen.getByText("視覚値確認").element();
    const footer = screen.getByText("操作").element();

    if (media === null) throw new Error("alert-dialog-media が見つかりません");

    expect(getComputedStyle(popup).gap).toBe("24px");
    expect(getComputedStyle(popup).display).toBe("flex");
    expect(getComputedStyle(popup).flexDirection).toBe("column");
    expect(getComputedStyle(popup).padding).toBe("24px");
    expect(getComputedStyle(popup).maxWidth).toBe("512px");
    expect(getComputedStyle(media).width).toBe("64px");
    expect(getComputedStyle(icon).width).toBe("32px");
    expect(getComputedStyle(title).fontSize).toBe("18px");
    expect(getComputedStyle(footer).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(footer).borderTopWidth).toBe("0px");
  });
});
