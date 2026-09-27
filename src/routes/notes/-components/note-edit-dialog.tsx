import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";

import { Dialog } from "@/components/ui/dialog";
import { updateNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

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

  // close を止める条件は作成のダイアログ (`note-create-dialog.tsx`) と同じ。応答前だけ止め、
  // 再取得中かどうかで応答済みを判別する (ADR-0017「ブロック範囲」)
  const isRefetchingNotes = useIsFetching({ queryKey: NOTES_QUERY_KEY }) > 0;
  const blocksClose = updateMutation.isPending && !isRefetchingNotes;

  // 閉じる animation が終わってから作り直す (作成のダイアログと同じ)
  const [formKey, setFormKey] = useState(0);
  function handleOpenChangeComplete(open: boolean) {
    if (!open) {
      setFormKey((key) => key + 1);
    }
  }

  // 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
  const handleOpenChange: ComponentProps<typeof Dialog>["onOpenChange"] = (open, details) => {
    // onSuccess の close は handle 経由なので reason が imperative-action になる。通す
    if (!open && blocksClose && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return (
    <Dialog
      handle={noteEditDialogHandle}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
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
            // 届くと、前の行の入力が残ったフォームで開く
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
