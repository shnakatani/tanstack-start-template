import { useQueryClient } from "@tanstack/react-query";

import { createDialogHandle, Dialog } from "@/components/ui/dialog";
import { createNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import type { NoteInput } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { useSubmitBlockingDialog } from "../-hooks/use-submit-blocking-dialog";
import { NoteFormContent } from "./note-form";

/** フォームの初期値 (作成は常に空)。`NoteFormContent` の `defaultValues` に渡す */
const EMPTY_NOTE_INPUT = { title: "", body: "", dueDate: null } satisfies NoteInput;

/**
 * 追加ボタン (route の PageHeader) と Root (このファイル) を結ぶ detached trigger の handle。
 * Root は 1 handle につき 1 つなので、`NoteCreateDialog` は同時に 1 箇所でだけ描画する。
 */
export const noteCreateDialogHandle = createDialogHandle<undefined>();

/**
 * メモの追加ダイアログ。内部スクロール方式 (`ActionDialogContent` + `DialogScrollBody`) で、
 * ヘッダーとフッターを固定したまま入力領域だけをスクロールさせる。
 *
 * mutation はここが持ち、フォームの状態は開くたびに作り直す。フォームの submit は
 * `ActionDialogContent` に渡すので、フォームの状態を持つ `NoteFormContent` は Portal の外に居続ける。
 * 閉じ終わったら key を替えて作り直し、「前回の入力が残った状態で開く」を起こさない。
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
    // 完了点 (b): 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0017)。
    // 一覧側は useMutationState でこの pending を読み、新しい行を先に出す。
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる
    onSuccess: async (_data, input) => {
      noteCreateDialogHandle.close();
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 一覧への行の追加は読み上げに出ないので、完了を通知する。追加は再取得を待つ間に開き直して
      // 保存でき並行しうるので、どれが終わったかを対象名で区別する (ADR-0026)
      announce(`『${input.title}』を保存しました`);
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  const { blocksClose, formKey, onOpenChange, onOpenChangeComplete } = useSubmitBlockingDialog({
    isPending: createMutation.isPending,
    queryKey: NOTES_QUERY_KEY,
  });

  return (
    <Dialog
      handle={noteCreateDialogHandle}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      {/* pending 表示は ActionFormSubmit が Action 層から取る。ここで渡すのは表示ではなく
          close の可否で、onOpenChange と同じ源 (useSubmitBlockingDialog) から取らないと「押せるのに閉じない」ずれが
          出る (ADR-0017 の完了点: サーバーの応答で閉じる) */}
      <NoteFormContent
        key={formKey}
        heading="メモを追加"
        defaultValues={EMPTY_NOTE_INPUT}
        onSubmit={createMutation.runAction}
        blocksClose={blocksClose}
      />
    </Dialog>
  );
}
