import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouteDialog } from "@/hooks/use-route-dialog";
import type { RouteDialogFinalFocus } from "@/lib/route-dialog-final-focus";

/**
 * フォームを出せない間のダイアログの中身。閉じ方は呼び出し側の Dialog の Root が決める。
 * `closedBeforeUnmount` は unmount の前に閉じ始めていたか。本物のダイアログに替わる、route を離れるなど、
 * 開いたまま unmount したときは false のまま
 */
function RouteStatusDialogContent({
  title,
  description,
  action,
  finalFocus,
  closedBeforeUnmount,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  finalFocus: RouteDialogFinalFocus;
  closedBeforeUnmount: boolean;
}) {
  return (
    <DialogContent finalFocus={() => finalFocus(closedBeforeUnmount)}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>閉じる</DialogClose>
        {action}
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * ダイアログの route が、フォームを出せない間 (見つからない、読み込みの失敗) に出すダイアログ (ADR-0041)。
 * 閉じる操作のあと、閉じるアニメーションが終わってから `onClosed` を呼ぶ。文言と、閉じる以外の操作
 * (再試行のボタンなど) は呼ぶ側が渡す
 */
export function RouteStatusDialog({
  onClosed,
  ...props
}: {
  title: string;
  description: string;
  action?: ReactNode;
  onClosed: () => void;
  finalFocus: RouteDialogFinalFocus;
}) {
  const { open, closedBeforeUnmount, onOpenChange, onOpenChangeComplete } = useRouteDialog({
    onClosed,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <RouteStatusDialogContent {...props} closedBeforeUnmount={closedBeforeUnmount} />
    </Dialog>
  );
}

/**
 * ダイアログの route の読み込み (loader の取得、component の chunk) が `pendingMs` を超えたときに出す
 * (`pendingComponent`、ADR-0041)。開くリンクを押さずに開いた (戻る・進む、URL を直接開いた) ときも、ここで
 * 読み込み中だと分かる。
 * `RouteStatusDialog` と違い、閉じる操作の時点で `onClose` を呼び、閉じるアニメーションを待たない。待つ間に
 * 読み込みが終わると、本物のダイアログがこれに替わって開く
 */
export function RoutePendingDialog({
  onClose,
  ...props
}: {
  title: string;
  onClose: () => void;
  finalFocus: RouteDialogFinalFocus;
}) {
  const [open, setOpen] = useState(true);
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false);
      onClose();
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <RouteStatusDialogContent {...props} closedBeforeUnmount={!open} description="読み込み中" />
    </Dialog>
  );
}
