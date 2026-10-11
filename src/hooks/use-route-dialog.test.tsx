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
import { slowDownClosingDialogs } from "@/test/browser/closing-dialogs";

import { useRouteDialog } from "./use-route-dialog";

/**
 * hook の返り値を Dialog の Root へ渡す。「保存を終える」は保存の `onSuccess` が `setOpen(false)` で閉じるのを
 * 模す。キャンセルには `blocksClose` を渡さず、止める判定が hook の `onOpenChange` にあることを見る
 */
function RouteDialogHarness({ onClosed, isPending }: { onClosed: () => void; isPending: boolean }) {
  const { open, setOpen, onOpenChange, onOpenChangeComplete } = useRouteDialog({
    onClosed,
    isPending,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <DialogContent>
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
});
