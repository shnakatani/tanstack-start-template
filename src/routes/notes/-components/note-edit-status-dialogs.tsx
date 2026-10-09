import type { ReactNode } from "react";

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
import type { Note } from "@/features/notes/schema";
import { useRouteRetry } from "@/hooks/use-route-retry";

import { useRouteDialog } from "../-hooks/use-route-dialog";
import { focusAfterNoteEditClosed } from "../-lib/note-edit-focus";
import { NOTE_EDIT_DIALOG_TITLE } from "../-lib/notes-page-constants";

interface NoteEditStatusDialogProps {
  noteId: Note["id"];
  onClosed: () => void;
}

/**
 * 編集のフォームを出せない間のダイアログの器。閉じたら一覧の route へ戻る。`leaveOnClose` を立てると、
 * 閉じるアニメーションの後ではなく、閉じる操作の時点で戻る
 */
function NoteEditStatusDialog({
  noteId,
  onClosed,
  title,
  description,
  action,
  leaveOnClose = false,
}: NoteEditStatusDialogProps & {
  title: string;
  description: string;
  action?: ReactNode;
  leaveOnClose?: boolean;
}) {
  const { open, setOpen, onOpenChangeComplete } = useRouteDialog(onClosed);
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && leaveOnClose) {
      onClosed();
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={leaveOnClose ? undefined : onOpenChangeComplete}
    >
      {/* open が false なのは利用者が閉じたとき。本物のダイアログに替わる、route を離れるなど、
          開いたまま unmount したときは true のまま */}
      <DialogContent finalFocus={() => focusAfterNoteEditClosed(noteId, { closedByUser: !open })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>閉じる</DialogClose>
          {action}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 1 件の取得が `pendingMs` を超えたときに出す。開く行のリンクが一覧に無い (戻る・進む、URL を直接開いた)
 * ときも、ここで読み込み中だと分かる。
 * 閉じたら閉じるアニメーションを待たずに一覧へ戻る。待つ間に取得が終わると、本物のダイアログがこれに
 * 替わって開く
 */
export function NoteEditPendingDialog(props: NoteEditStatusDialogProps) {
  return (
    <NoteEditStatusDialog
      {...props}
      title={NOTE_EDIT_DIALOG_TITLE}
      description="読み込み中"
      leaveOnClose
    />
  );
}

export function NoteEditNotFoundDialog(props: NoteEditStatusDialogProps) {
  return (
    <NoteEditStatusDialog
      {...props}
      title="メモが見つかりません"
      description="削除されたか、URL が誤っています。"
    />
  );
}

/**
 * 1 件の取得の失敗。例外の文言は出さない。errorComponent で文言を描くのは `RouteErrorContent` に限り
 * (`docs/guides/server-errors.md`「詳細を出す環境を変える」)、`RouteErrorContent` は自分の h1 を持つので
 * ダイアログの中に置けない
 */
export function NoteEditErrorDialog(props: NoteEditStatusDialogProps) {
  const handleRetry = useRouteRetry();
  return (
    <NoteEditStatusDialog
      {...props}
      title="メモを読み込めませんでした"
      description="時間をおいて再試行してください。"
      action={<Button onClick={handleRetry}>再試行</Button>}
    />
  );
}
