import { useState } from "react";

/**
 * route として開くダイアログの開閉。開いた状態で mount し、閉じる操作では open を false にするだけにする。
 * route を離れる (onClosed) のは閉じるアニメーションが終わってから。先に離れると route ごと unmount して、
 * 閉じるアニメーションが出ない
 */
export function useRouteDialog(onClosed: () => void) {
  const [open, setOpen] = useState(true);
  function onOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen) {
      onClosed();
    }
  }
  return { open, setOpen, onOpenChangeComplete };
}
