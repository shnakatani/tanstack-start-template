import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { Dialog } from "@/components/ui/dialog";
import { updateNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY, noteQueryOptions } from "@/features/notes/queries";
import type { Note } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { useRouteDialog } from "../-hooks/use-route-dialog";
import { useSubmitBlockingDialog } from "../-hooks/use-submit-blocking-dialog";
import { focusAfterNoteEditClosed } from "../-lib/note-edit-focus";
import { NOTE_EDIT_DIALOG_TITLE } from "../-lib/notes-page-constants";
import { NoteFormContent } from "./note-form";

/**
 * メモの編集ダイアログ。編集の route (`$noteId.edit.tsx`) の component が描き、loader が取り直した
 * 1 件をフォームの初期値にする (ADR-0041)。route に入るたびに mount するので、フォームも mutation も
 * 開くたびに作り直す。閉じたら `onClosed` で一覧の route へ戻る
 */
export function NoteEditDialog({ noteId, onClosed }: { noteId: Note["id"]; onClosed: () => void }) {
  const queryClient = useQueryClient();
  const { data: note } = useSuspenseQuery(noteQueryOptions(noteId));
  const { open, setOpen, onOpenChangeComplete } = useRouteDialog(onClosed);

  const updateMutation = useActionMutation({
    ...updateNoteMutation,
    // 開始の通知の置き場 (ADR-0026)。form の検証を通った後だけ走る。ボタンの pending は
    // 読み上げに出ないので開始を通知する。開始は押した直後なので対象名を載せない
    onMutate: () => {
      announce("更新しています");
    },
    // 完了点「サーバー応答」: 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0017)。
    // 閉じると route を離れて unmount するが、useMutation に渡した callback はそのあとも走る
    // (`mutate` に渡す callback は走らない。TanStack Query「Mutations」)
    onSuccess: async (_data, update) => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 行の値の変化は読み上げに出ないので、完了を通知する。更新は再取得を待つ間に別の行でも
      // 保存でき並行しうるので、どれが終わったかを対象名 (更新後の title) で区別する (ADR-0026)
      announce(`『${update.title}』を更新しました`);
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  const { blocksClose, onOpenChange } = useSubmitBlockingDialog({
    isPending: updateMutation.isPending,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        // 送信中の close は onOpenChange が止める (details.cancel())。止めたときは open を変えない
        onOpenChange(nextOpen, details);
        if (!details.isCanceled) {
          setOpen(nextOpen);
        }
      }}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <NoteFormContent
        heading={NOTE_EDIT_DIALOG_TITLE}
        defaultValues={{ title: note.title, body: note.body, dueDate: note.dueDate }}
        onSubmit={(input) => updateMutation.runAction({ id: note.id, ...input })}
        blocksClose={blocksClose}
        // open が false なのは利用者が閉じたとき。route を離れて開いたまま unmount したときは true のまま
        finalFocus={() => focusAfterNoteEditClosed(note.id, { closedByUser: !open })}
      />
    </Dialog>
  );
}
