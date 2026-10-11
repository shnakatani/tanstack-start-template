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
import { useRouteRetry } from "@/hooks/use-route-retry";

import { useRouteDialog } from "../-hooks/use-route-dialog";
import { focusAfterRouteDialogClosed } from "../-lib/note-dialog-focus";

/** 一覧の上に重ねるダイアログの route が、フォームを出せない間に出すダイアログの props */
interface NoteRouteStatusDialogProps {
  onClosed: () => void;
  /** focus の戻し先を決めるときに呼ぶ (`focusAfterRouteDialogClosed`) */
  isDialogRouteShown: () => boolean;
  /** 開いた元のリンクを探す (`focusAfterRouteDialogClosed`) */
  findReturnTarget: () => HTMLElement | null;
  title: string;
}

/**
 * フォームを出せない間のダイアログの中身。閉じ方は呼び出し側の Dialog の Root が決める。
 * `closedByUser` は利用者が閉じたか。本物のダイアログに替わる、route を離れるなど、開いたまま unmount
 * したときは false のまま
 */
function NoteRouteStatusDialogContent({
  isDialogRouteShown,
  findReturnTarget,
  closedByUser,
  title,
  description,
  action,
}: Omit<NoteRouteStatusDialogProps, "onClosed"> & {
  closedByUser: boolean;
  description: string;
  action?: ReactNode;
}) {
  return (
    <DialogContent
      finalFocus={() =>
        focusAfterRouteDialogClosed({ closedByUser, isDialogRouteShown, findReturnTarget })
      }
    >
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

/** 見つからない・読み込みの失敗のダイアログ。閉じるアニメーションの後で一覧の route へ戻る */
function NoteRouteStatusDialog({
  onClosed,
  ...props
}: NoteRouteStatusDialogProps & { description: string; action?: ReactNode }) {
  const { open, onOpenChange, onOpenChangeComplete } = useRouteDialog({ onClosed });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <NoteRouteStatusDialogContent {...props} closedByUser={!open} />
    </Dialog>
  );
}

/**
 * route の読み込み (loader の取得、component の chunk) が `pendingMs` を超えたときに出す。開くリンクが
 * 一覧に無い (戻る・進む、URL を直接開いた) ときも、ここで読み込み中だと分かる。
 * 閉じたら閉じるアニメーションを待たずに一覧へ戻る。待つ間に読み込みが終わると、本物のダイアログがこれに
 * 替わって開く
 */
export function NoteRoutePendingDialog({ onClosed, ...props }: NoteRouteStatusDialogProps) {
  const [open, setOpen] = useState(true);
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false);
      onClosed();
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <NoteRouteStatusDialogContent {...props} closedByUser={!open} description="読み込み中" />
    </Dialog>
  );
}

export function NoteNotFoundDialog(props: Omit<NoteRouteStatusDialogProps, "title">) {
  return (
    <NoteRouteStatusDialog
      {...props}
      title="メモが見つかりません"
      description="削除されたか、URL が誤っています。"
    />
  );
}

/**
 * route の読み込み (loader の取得、component の chunk) の失敗。例外の文言は出さない。errorComponent で文言を
 * 描くのは `RouteErrorContent` に限り (`docs/guides/server-errors.md`「詳細を出す環境を変える」)、
 * `RouteErrorContent` は自分の h1 を持つのでダイアログの中に置けない
 */
export function NoteRouteErrorDialog(props: NoteRouteStatusDialogProps) {
  const handleRetry = useRouteRetry();
  return (
    <NoteRouteStatusDialog
      {...props}
      description="時間をおいて再試行してください。"
      action={<Button onClick={handleRetry}>再試行</Button>}
    />
  );
}
