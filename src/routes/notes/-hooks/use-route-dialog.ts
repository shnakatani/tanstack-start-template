import { useState, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";

import { blocksUserClose } from "../-lib/dialog-close-blocking";

/**
 * route として開くダイアログの開閉。開いた状態で mount し、閉じる操作では open を false にするだけにする。
 * route を離れる (onClosed) のは閉じるアニメーションが終わってから。先に離れると route ごと unmount して、
 * 閉じるアニメーションが出ない。
 * 返り値の `onOpenChange` と `onOpenChangeComplete` は Dialog の Root へ、`blocksClose` はフォームへ渡す。
 *
 * - onClosed: route を離れる
 * - isPending: 保存の mutation の pending。保存しないダイアログは渡さない
 */
export function useRouteDialog({
  onClosed,
  isPending = false,
}: {
  onClosed: () => void;
  isPending?: boolean;
}) {
  const [open, setOpen] = useState(true);

  // 保存の mutation が pending の間は、ユーザー起点の close を止める。応答の前に閉じると route ごと
  // unmount し、保存に失敗したときに入力が残らない (完了点「サーバー応答」、ADR-0017)。止めるのは
  // このダイアログだけで、一覧の操作は止めない (ADR-0017「ブロック範囲」)
  const blocksClose = isPending;

  // 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
  const onOpenChange: NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]> = (
    nextOpen,
    details,
  ) => {
    // 止めたときは open を変えない。保存の onSuccess は setOpen(false) で閉じ、ここを通らない
    if (blocksUserClose(nextOpen, details, blocksClose)) {
      details.cancel();
      return;
    }
    setOpen(nextOpen);
  };

  function onOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen) {
      onClosed();
    }
  }

  return { open, setOpen, blocksClose, onOpenChange, onOpenChangeComplete };
}
