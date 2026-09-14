import type { DeleteTarget } from "@/components/delete-confirm-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { createAlertDialogHandle } from "@/components/ui/alert-dialog";
import type { Note } from "@/features/notes/schema";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";

/**
 * 削除確認ダイアログの detached trigger (一覧の各行) を Root へ結ぶ handle。
 * Root は 1 handle につき 1 つ (`NoteDeleteDialog`)。列定義側はこの handle だけを import する
 */
export const noteDeleteDialogHandle = createAlertDialogHandle<DeleteTarget<Note["id"]>>();

/** 削除確認ダイアログの Root。ページが 1 つだけ描画する。 */
export function NoteDeleteDialog({
  onConfirm,
}: {
  onConfirm: (target: DeleteTarget<Note["id"]>) => void;
}) {
  return (
    <DeleteConfirmDialog
      handle={noteDeleteDialogHandle}
      entityLabel={NOTE_ENTITY_LABEL}
      onConfirm={onConfirm}
    />
  );
}
