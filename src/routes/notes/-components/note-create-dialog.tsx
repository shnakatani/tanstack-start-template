import { useQueryClient } from "@tanstack/react-query";

import { Dialog } from "@/components/ui/dialog";
import { createNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import type { NoteInput } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useRouteDialog } from "@/hooks/use-route-dialog";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { findNoteCreateLink } from "../-lib/note-dialog-focus";
import { NOTE_CREATE_DIALOG_TITLE, NOTE_DIALOG_RETURN_TO } from "../-lib/notes-page-constants";
import { NoteFormContent } from "./note-form";

/** フォームの初期値 (作成は常に空)。`NoteFormContent` の `defaultValues` に渡す */
const EMPTY_NOTE_INPUT = { title: "", body: "", dueDate: null } satisfies NoteInput;

/**
 * メモの追加ダイアログ。追加の route (`new.tsx`) の component が描く (ADR-0041)。開くたびに route が mount
 * し直すので、フォームも mutation も開いたダイアログごとに別になる。閉じたら一覧の route へ戻り、追加のリンクへ
 * focus を戻す
 */
export function NoteCreateDialog() {
  const queryClient = useQueryClient();

  const createMutation = useActionMutation({
    ...createNoteMutation,
    // 開始の通知の置き場 (ADR-0026)。この画面は variables 方式 (ADR-0017) なのでキャッシュは触らない。
    // form の検証を通った後だけ走る。ボタンの pending は読み上げに出ないので開始を通知する。
    // 開始は押した直後なので対象名を載せない
    onMutate: () => {
      announce("保存しています");
    },
    // 完了点「サーバー応答」: 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0017)。
    // 一覧側は useMutationState でこの pending を読み、新しい行を先に出す。
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる。
    // 閉じると route を離れて unmount するが、useMutation に渡した callback はそのあとも走る
    // (unmount のあとに走らないのは `mutate` に渡す callback。TanStack Query「Mutations」)
    onSuccess: async (_data, input) => {
      close();
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 一覧への行の追加は読み上げに出ないので、完了を通知する。追加は再取得を待つ間に開き直して
      // 保存でき並行しうるので、どれが終わったかを対象名で区別する (ADR-0026)
      announce(`『${input.title}』を保存しました`);
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  const { close, blocksClose, onOpenChange, popupProps } = useRouteDialog({
    returnTo: NOTE_DIALOG_RETURN_TO,
    findReturnTarget: findNoteCreateLink,
    isPending: createMutation.isPending,
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <NoteFormContent
        heading={NOTE_CREATE_DIALOG_TITLE}
        defaultValues={EMPTY_NOTE_INPUT}
        onSubmit={createMutation.runAction}
        blocksClose={blocksClose}
        popupProps={popupProps}
      />
    </Dialog>
  );
}
