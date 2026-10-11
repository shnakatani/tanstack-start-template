import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RouteDialogFinalFocus } from "@/lib/route-dialog-final-focus";
import { slowDownClosingDialogs } from "@/test/browser/closing-dialogs";

import { useRouteDialog } from "./use-route-dialog";

const keepFocus: RouteDialogFinalFocus = () => false;

/**
 * hook の返り値を Dialog の Root へ渡す。「保存を終える」は保存の `onSuccess` が `setOpen(false)` で閉じるのを
 * 模す。キャンセルには `blocksClose` を渡さず、止める判定が hook の `onOpenChange` にあることを見る
 */
function RouteDialogHarness({
  onClosed,
  isPending,
  finalFocus = keepFocus,
}: {
  onClosed: () => void;
  isPending: boolean;
  finalFocus?: RouteDialogFinalFocus;
}) {
  const { open, setOpen, closedBeforeUnmount, onOpenChange, onOpenChangeComplete } = useRouteDialog(
    { onClosed, isPending },
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <DialogContent finalFocus={() => finalFocus(closedBeforeUnmount)}>
        <DialogHeader>
          <DialogTitle>項目を編集</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
          <Button onClick={() => setOpen(false)}>保存を終える</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("useRouteDialog", () => {
  it("閉じる操作のあと、閉じるアニメーションの間は onClosed を呼ばない", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    const onClosed = vi.fn<() => void>();
    const screen = await render(<RouteDialogHarness onClosed={onClosed} isPending={false} />);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(slowedWhileClosing).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("閉じ終えたら onClosed を 1 回呼ぶ", async () => {
    const onClosed = vi.fn<() => void>();
    const screen = await render(<RouteDialogHarness onClosed={onClosed} isPending={false} />);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it("保存の pending の間は Escape で閉じず、pending が終わると閉じられる", async () => {
    const onClosed = vi.fn<() => void>();
    const screen = await render(<RouteDialogHarness onClosed={onClosed} isPending />);
    const dialog = screen.getByRole("dialog", { name: "項目を編集" });
    await expect.element(dialog).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await screen.rerender(<RouteDialogHarness onClosed={onClosed} isPending={false} />);
    // Escape で閉じていれば、キャンセルは閉じかけか外れていて押せない
    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it("保存の pending の間でも、setOpen(false) では閉じて onClosed を呼ぶ", async () => {
    const onClosed = vi.fn<() => void>();
    const screen = await render(<RouteDialogHarness onClosed={onClosed} isPending />);

    await screen.getByRole("button", { name: "保存を終える" }).click();

    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it.each(["キャンセル", "保存を終える"])(
    "%s で閉じたら、finalFocus に closedBeforeUnmount の true を渡す",
    async (button) => {
      const finalFocus = vi.fn<RouteDialogFinalFocus>(() => false);
      const screen = await render(
        <RouteDialogHarness onClosed={() => {}} isPending={false} finalFocus={finalFocus} />,
      );

      await screen.getByRole("button", { name: button }).click();

      await expect.poll(() => finalFocus).toHaveBeenCalledExactlyOnceWith(true);
    },
  );

  it("開いたまま unmount したら、finalFocus に closedBeforeUnmount の false を渡す", async () => {
    const finalFocus = vi.fn<RouteDialogFinalFocus>(() => false);
    const screen = await render(
      <RouteDialogHarness onClosed={() => {}} isPending={false} finalFocus={finalFocus} />,
    );
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    await screen.unmount();

    await expect.poll(() => finalFocus).toHaveBeenCalledExactlyOnceWith(false);
  });
});
