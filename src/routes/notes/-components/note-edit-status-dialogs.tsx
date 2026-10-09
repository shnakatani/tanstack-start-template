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
 * 編集のフォームを出せない間のダイアログの中身。閉じ方は呼び出し側の Dialog の Root が決める。
 * `closedByUser` は利用者が閉じたか。本物のダイアログに替わる、route を離れるなど、開いたまま unmount
 * したときは false のまま
 */
function NoteEditStatusDialogContent({
  noteId,
  closedByUser,
  title,
  description,
  action,
}: {
  noteId: Note["id"];
  closedByUser: boolean;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <DialogContent finalFocus={() => focusAfterNoteEditClosed(noteId, { closedByUser })}>
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

/** 見つからない・取得の失敗のダイアログ。閉じるアニメーションの後で一覧の route へ戻る */
function NoteEditStatusDialog({
  noteId,
  onClosed,
  title,
  description,
  action,
}: NoteEditStatusDialogProps & {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { open, setOpen, onOpenChangeComplete } = useRouteDialog(onClosed);
  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={onOpenChangeComplete}>
      <NoteEditStatusDialogContent
        noteId={noteId}
        closedByUser={!open}
        title={title}
        description={description}
        action={action}
      />
    </Dialog>
  );
}

/**
 * 1 件の取得が `pendingMs` を超えたときに出す。開く行のリンクが一覧に無い (戻る・進む、URL を直接開いた)
 * ときも、ここで読み込み中だと分かる。
 * 閉じたら閉じるアニメーションを待たずに一覧へ戻る。待つ間に取得が終わると、本物のダイアログがこれに
 * 替わって開く
 */
export function NoteEditPendingDialog({ noteId, onClosed }: NoteEditStatusDialogProps) {
  const [open, setOpen] = useState(true);
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false);
      onClosed();
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <NoteEditStatusDialogContent
        noteId={noteId}
        closedByUser={!open}
        title={NOTE_EDIT_DIALOG_TITLE}
        description="読み込み中"
      />
    </Dialog>
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
