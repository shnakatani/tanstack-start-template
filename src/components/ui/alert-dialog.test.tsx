import { afterEach, describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  expectWithinViewport,
  restoreDefaultViewport,
  setViewport,
  TABLET_VIEWPORT,
} from "@/test/viewport";

/**
 * AlertDialogContent の viewport 溢れ backstop。Dialog と共有する registry 乖離
 * (Viewport + `popupOverflowBackstop` + Popup の flex-col。ADR-0006 の許容リスト) のガード。
 * `registry-baseline.test.ts` は baseline の存在しか見ず、乖離が消えても落ちないことを
 * 実測した (2026-09-22) ので、乖離の機能はここで固定する。
 *
 * 到達性は実キーボードで見る。Popup は開いたとき focus を受け、End で末尾までスクロール
 * する。溢れコンテンツは `minHeight` で作る (flex item は既定で縮む。dialog.test.tsx 参照)。
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

  it("Popup は Viewport の中で flex-col に組まれ、長身コンテンツでも viewport 内に収まる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();

    // base-ui 公式 anatomy: Popup は Viewport (配置コンテナ) の中に置く
    const popup = screen.getBySlot("alert-dialog-viewport").getByRole("alertdialog");
    await expect.element(popup).toHaveStyle("display: flex; flex-direction: column");
    expectWithinViewport(popup);
  });

  it("キーボードで最下部コンテンツまで到達できる", async () => {
    await setViewport(TABLET_VIEWPORT);
    const screen = await renderTallAlertDialog();
    const marker = screen.getByText(BOTTOM_MARKER);

    await expect.element(screen.getByText("先頭コンテンツ")).toBeInViewport();
    await expect.element(marker).not.toBeInViewport();

    await userEvent.keyboard("{End}");

    await expect.element(marker).toBeInViewport();
  });
});
