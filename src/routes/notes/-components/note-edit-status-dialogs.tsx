import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

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

import { useRouteDialog } from "../-hooks/use-route-dialog";
import { focusAfterNoteEditClosed } from "../-lib/note-edit-focus";
import { NOTE_EDIT_DIALOG_TITLE } from "../-lib/notes-page-constants";

interface NoteEditStatusDialogProps {
  noteId: Note["id"];
  onClosed: () => void;
}

/** 編集のフォームを出せない間のダイアログの器。閉じたら一覧の route へ戻る */
function NoteEditStatusDialog({
  noteId,
  onClosed,
  title,
  description,
  action,
}: NoteEditStatusDialogProps & { title: string; description: string; action?: ReactNode }) {
  const { open, setOpen, onOpenChangeComplete } = useRouteDialog(onClosed);
  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={onOpenChangeComplete}>
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
 * 1 件の取得が `pendingMs` を超えたときに出す。押した行が一覧に無い (絞り込みで外れた) ときも、
 * ここで読み込み中だと分かる
 */
export function NoteEditPendingDialog(props: NoteEditStatusDialogProps) {
  return (
    <NoteEditStatusDialog {...props} title={NOTE_EDIT_DIALOG_TITLE} description="読み込み中" />
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
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  // 表示時に Query の error boundary を戻す。戻さないと再試行で取り直さない
  // (`docs/guides/data-loading.md`「読み込みに失敗した画面から再試行する」)
  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  // 再実行の結果は loader と error boundary が受けるため待たない
  function handleRetry() {
    void router.invalidate();
  }

  return (
    <NoteEditStatusDialog
      {...props}
      title="メモを読み込めませんでした"
      description="時間をおいて再試行してください。"
      action={<Button onClick={handleRetry}>再試行</Button>}
    />
  );
}
