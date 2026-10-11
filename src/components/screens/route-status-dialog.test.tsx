import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import type { RouteDialogFinalFocus } from "@/lib/route-dialog-final-focus";
import { slowDownClosingDialogs } from "@/test/browser/closing-dialogs";

import { RoutePendingDialog, RouteStatusDialog } from "./route-status-dialog";

function finalFocusSpy() {
  return vi.fn<RouteDialogFinalFocus>(() => false);
}

describe("RouteStatusDialog", () => {
  it("見出しと説明をダイアログの名前と説明にし、渡した操作を閉じるの隣に並べる", async () => {
    const screen = await render(
      <RouteStatusDialog
        title="項目が見つかりません"
        description="削除されたか、URL が誤っています。"
        action={<Button>再試行</Button>}
        onClosed={() => {}}
        finalFocus={finalFocusSpy()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "項目が見つかりません" });
    await expect.element(dialog).toHaveAccessibleDescription("削除されたか、URL が誤っています。");
    await expect.element(dialog.getByRole("button", { name: "閉じる" })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "再試行" })).toBeVisible();
  });

  it("閉じる操作のあと、閉じるアニメーションの間は onClosed を呼ばない", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    const onClosed = vi.fn<() => void>();
    const screen = await render(
      <RouteStatusDialog
        title="項目が見つかりません"
        description="削除されたか、URL が誤っています。"
        onClosed={onClosed}
        finalFocus={finalFocusSpy()}
      />,
    );

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.poll(slowedWhileClosing).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("閉じ終えたら onClosed を 1 回呼ぶ", async () => {
    const onClosed = vi.fn<() => void>();
    const screen = await render(
      <RouteStatusDialog
        title="項目が見つかりません"
        description="削除されたか、URL が誤っています。"
        onClosed={onClosed}
        finalFocus={finalFocusSpy()}
      />,
    );

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });
});

describe("RoutePendingDialog", () => {
  it("閉じる操作の時点で、閉じるアニメーションを待たずに onClose を呼ぶ", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    const onClose = vi.fn<() => void>();
    const screen = await render(
      <RoutePendingDialog title="項目を編集" onClose={onClose} finalFocus={finalFocusSpy()} />,
    );
    await expect
      .element(screen.getByRole("dialog", { name: "項目を編集" }))
      .toHaveAccessibleDescription("読み込み中");

    await screen.getByRole("button", { name: "閉じる" }).click();

    // 閉じるアニメーションは 60 秒に延ばしてあるので、呼ばれたならアニメーションの終わりを待っていない
    await expect.poll(() => onClose).toHaveBeenCalledOnce();
    expect(slowedWhileClosing()).toBe(true);
  });
});

describe.each([
  {
    dialog: "RouteStatusDialog",
    renderDialog: (finalFocus: RouteDialogFinalFocus) => (
      <RouteStatusDialog
        title="項目が見つかりません"
        description="削除されたか、URL が誤っています。"
        onClosed={() => {}}
        finalFocus={finalFocus}
      />
    ),
  },
  {
    dialog: "RoutePendingDialog",
    renderDialog: (finalFocus: RouteDialogFinalFocus) => (
      <RoutePendingDialog title="項目を編集" onClose={() => {}} finalFocus={finalFocus} />
    ),
  },
])("$dialog の finalFocus", ({ renderDialog }) => {
  it("閉じる操作で閉じたら、closedBeforeUnmount に true を渡す", async () => {
    const finalFocus = finalFocusSpy();
    const screen = await render(renderDialog(finalFocus));

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.poll(() => finalFocus).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("開いたまま unmount したら、closedBeforeUnmount に false を渡す", async () => {
    const finalFocus = finalFocusSpy();
    const screen = await render(renderDialog(finalFocus));
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    await screen.unmount();

    await expect.poll(() => finalFocus).toHaveBeenCalledExactlyOnceWith(false);
  });
});
