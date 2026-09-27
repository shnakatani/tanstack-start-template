import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";

import { createDialogHandle, Dialog } from "@/components/ui/dialog";
import { createNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import type { NoteInput } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

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
    // form の検証を通った後だけ走る。ボタンの pending は読み上げに出ないので開始を通知する
    onMutate: () => {
      announce("メモを保存しています");
    },
    // 完了点 (b): 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0017)。
    // 一覧側は useMutationState でこの pending を読み、新しい行を先に出す。
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる
    onSuccess: async () => {
      noteCreateDialogHandle.close();
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 一覧への行の追加は読み上げに出ないので、完了を通知する (ADR-0026)
      announce("保存しました");
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // 再取得中かどうかを hook で読む。`queryClient.isFetching()` を render 中に呼んでも
  // 再描画されず、応答が届いても止めたままになる
  const isRefetchingNotes = useIsFetching({ queryKey: NOTES_QUERY_KEY }) > 0;

  // 止めるのは応答前だけ。閉じて開き直すと handleOpenChangeComplete が key を替えてフォームが
  // 作り直され、先行 save の応答が届いた時点で新しい入力ごと閉じる。handle を複数の対象で
  // 共有するダイアログと違い、入力フォームは開いている対象を mutation の対象と比べられない
  // ので、閉じないことで塞ぐ (`docs/guides/updates-and-data.md`「完了点ごとに Transition を終える」の (b))。止めるのはこのダイアログ
  // だけで、一覧の操作は止めない (ADR-0017「ブロック範囲」)。
  //
  // mutation の pending は応答後も再取得の完了まで続くので、それだけを見ると閉じた後の窓でも
  // true のままになり、開き直したダイアログが閉じられなくなる。再取得中かどうかで応答済みを
  // 判別する。無関係な background refetch と重なると応答前でも通す方向に倒れるが、それは
  // ADR-0017 移行前の従来挙動 (何も止めない) と同じなので、閉じられなくなる側へは倒さない
  const blocksClose = createMutation.isPending && !isRefetchingNotes;

  // 閉じる animation が終わってから作り直す。閉じた瞬間に替えると、消えていく途中の
  // ダイアログの入力が空になって見える。onOpenChangeComplete(false) は Base UI が Portal を
  // unmount するのと同じ callback で呼ばれる。閉じる途中で開き直すと、Portal も unmount されず
  // 入力は残る
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
      handle={noteCreateDialogHandle}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      {/* pending 表示は ActionFormSubmit が Action 層から取る。ここで渡すのは表示ではなく
          close の可否で、handleOpenChange と同じ源から取らないと「押せるのに閉じない」ずれが
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
