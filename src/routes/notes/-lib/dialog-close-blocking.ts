import type { ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";

// 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
type DialogOpenChangeDetails = Parameters<
  NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]>
>[1];

/**
 * 保存の pending の間に止める close か。止めるのは利用者の close だけにする。handle で閉じた close
 * (reason が imperative-action) は保存の onSuccess なので通す。止めたら呼び出し側が `details.cancel()` する
 */
export function blocksUserClose(
  nextOpen: boolean,
  details: Pick<DialogOpenChangeDetails, "reason">,
  blocksClose: boolean,
): boolean {
  return !nextOpen && blocksClose && details.reason !== "imperative-action";
}
