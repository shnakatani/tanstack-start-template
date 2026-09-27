import { useQueryClient } from "@tanstack/react-query";

import { Dialog } from "@/components/ui/dialog";
import { updateNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { useSubmitBlockingDialog } from "../-hooks/use-submit-blocking-dialog";
import { noteEditDialogHandle } from "../-lib/note-edit-dialog-handle";
import { NoteFormContent } from "./note-form";

/**
 * メモの編集ダイアログ。フォームは作成のダイアログと同じ `NoteFormContent` で、初期値に handle の
 * payload (編集する行の `Note`) の今の値を入れる。
 *
 * mutation はここが持ち、フォームの状態は開くたびに作り直す (作成のダイアログと同じ)。
 */
export function NoteEditDialog() {
  const queryClient = useQueryClient();

  const updateMutation = useActionMutation({
    ...updateNoteMutation,
    // 開始の通知の置き場 (ADR-0026)。form の検証を通った後だけ走る。ボタンの pending は
    // 読み上げに出ないので開始を通知する。対象名は保存する入力 (更新後の title) から取る
    onMutate: (update) => {
      announce(`『${update.title}』を更新しています`);
    },
    // 完了点 (b): 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0017)。
    // 一覧の再取得は queryKey の前方一致に委ねる
    onSuccess: async (_data, update) => {
      noteEditDialogHandle.close();
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 行の値の変化は読み上げに出ないので、完了を通知する。更新は再取得を待つ間に別の行でも
      // 保存でき並行しうるので、どれが終わったかを対象名で区別する (ADR-0026)
      announce(`『${update.title}』を更新しました`);
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  const { blocksClose, formKey, onOpenChange, onOpenChangeComplete } = useSubmitBlockingDialog({
    isPending: updateMutation.isPending,
    queryKey: NOTES_QUERY_KEY,
  });

  return (
    <Dialog
      handle={noteEditDialogHandle}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {({ payload }) => {
        // payload は行の編集ボタン (この handle の Trigger) が必ず渡し、payload 無しで開く呼び出しは
        // アプリに無い。閉じている間は payload 無しで呼ばれるので、Base UI の docs の例と同じく描かない
        if (!payload) {
          return null;
        }
        return (
          <NoteFormContent
            // 行ごとに作り直す。useAppForm は defaultValues を作成時に読み、後から変わった値は
            // 入力に触れていないフォームにしか反映されない。閉じる途中で別の行の payload が
            // 届くと、前の行の入力が残ったフォームで開く。対象が変わったら key で作り直すのは
            // React docs「Resetting all state when a prop changes」の形
            key={`${formKey}-${payload.id}`}
            heading="メモを編集"
            defaultValues={{ title: payload.title, body: payload.body, dueDate: payload.dueDate }}
            onSubmit={(input) => updateMutation.runAction({ id: payload.id, ...input })}
            blocksClose={blocksClose}
          />
        );
      }}
    </Dialog>
  );
}
