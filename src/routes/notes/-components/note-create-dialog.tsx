import { revalidateLogic } from "@tanstack/react-form";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { ActionForm, ActionFormSubmit } from "@/components/action/form";
import { DialogScrollBody, dialogScrollLayout } from "@/components/parts/dialog-scroll-body";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { createNoteMutation } from "@/features/notes/mutations";
import { notesQueryOptions } from "@/features/notes/queries";
import type { NoteInput } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS, noteInputSchema } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useAppForm } from "@/hooks/use-app-form";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

/**
 * 追加ボタン (route の PageHeader) と Root (このファイル) を結ぶ detached trigger の handle。
 * Root は 1 handle につき 1 つなので、`NoteCreateDialog` は同時に 1 箇所でだけ描画する。
 */
export const noteCreateDialogHandle = createDialogHandle<undefined>();

/**
 * メモの追加ダイアログ。内部スクロール方式 (`dialogScrollLayout` + `DialogScrollBody`) で、
 * ヘッダーとフッターを固定したまま入力領域だけをスクロールさせる。
 *
 * mutation はここが持ち、フォームの状態は開くたびに作り直す。`DialogContent` は Portal 配下で
 * 閉じるとアンマウントされるため、フォーム本体を子コンポーネントに分けておくと
 * 「前回の入力が残った状態で開く」が構造的に起こらない。
 */
export function NoteCreateDialog() {
  const queryClient = useQueryClient();

  const createMutation = useActionMutation({
    ...createNoteMutation,
    // 開始の通知の置き場 (ADR-0017)。この画面は variables 方式 (ADR-0016) なのでキャッシュは触らない。
    // form の検証を通った後だけ走る。ボタンの pending は読み上げに出ないので開始を通知する
    onMutate: () => {
      announce("メモを保存しています");
    },
    // 完了点 (b): 応答で閉じ、再取得を await して pending を再取得完了まで保つ (ADR-0016)。
    // 一覧側は useMutationState でこの pending を読み、新しい行を先に出す。
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる
    onSuccess: async () => {
      noteCreateDialogHandle.close();
      await queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey });
      // 一覧への行の追加は読み上げに出ないので、完了を通知する (ADR-0017)
      announce("保存しました");
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // 再取得中かどうかを hook で読む。`queryClient.isFetching()` を render 中に呼んでも
  // 再描画されず、応答が届いても止めたままになる
  const isRefetchingNotes = useIsFetching({ queryKey: notesQueryOptions.queryKey }) > 0;

  // 止めるのは応答前だけ。閉じて開き直すと DialogContent がアンマウントされてフォームが
  // 作り直され、先行 save の応答が届いた時点で新しい入力ごと閉じる。handle を複数の対象で
  // 共有するダイアログと違い、入力フォームは開いている対象を mutation の対象と比べられない
  // ので、閉じないことで塞ぐ (ADR-0016 Decision の完了点 (b) の行)。止めるのはこのダイアログ
  // だけで、一覧の操作は止めない (ADR-0016「ブロック範囲」)。
  //
  // mutation の pending は応答後も再取得の完了まで続くので、それだけを見ると閉じた後の窓でも
  // true のままになり、開き直したダイアログが閉じられなくなる。再取得中かどうかで応答済みを
  // 判別する。無関係な background refetch と重なると応答前でも通す方向に倒れるが、それは
  // ADR-0016 移行前の従来挙動 (何も止めない) と同じなので、閉じられなくなる側へは倒さない
  const blocksClose = createMutation.isPending && !isRefetchingNotes;

  // 型は転送先の props から導出する (`.claude/rules/typing.md`「ラッパー部品の転送 prop 型」)
  const handleOpenChange: ComponentProps<typeof Dialog>["onOpenChange"] = (open, details) => {
    // onSuccess の close は handle 経由なので reason が imperative-action になる。通す
    if (!open && blocksClose && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return (
    <Dialog handle={noteCreateDialogHandle} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メモを追加</DialogTitle>
        </DialogHeader>
        {/* pending 表示は ActionFormSubmit が Action 層から取る。ここで渡すのは表示ではなく
            close の可否で、handleOpenChange と同じ源から取らないと「押せるのに閉じない」ずれが
            出る (`.claude/rules/implementation.md` の pending の項目) */}
        <NoteCreateForm onSubmit={createMutation.runAction} blocksClose={blocksClose} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * 入力フォーム。フィールドに `autoFocus` は渡さない — base-ui の Popup が既定でポップアップ内の
 * 最初の tabbable へフォーカスを移し、タッチ操作のときだけ仮想キーボードを開かないよう Popup
 * 自身を選ぶ。`autoFocus` はこの出し分けを潰す (初期フォーカス位置は
 * `note-create-dialog.test.tsx` が固定している)。
 */
function NoteCreateForm({
  onSubmit,
  blocksClose,
}: {
  onSubmit: (note: NoteInput) => Promise<void>;
  /** 保存の応答待ちで close を止めている間か。キャンセルも同じ源で無効化して見た目と挙動を揃える */
  blocksClose: boolean;
}) {
  const initialValues: NoteInput = { title: "", body: "" };

  const form = useAppForm({
    defaultValues: initialValues,
    // 初回 submit までは検証エラーを表示せず、submit 後は変更毎に再検証する
    // (revalidateLogic のデフォルト: mode:"submit", modeAfterSubmission:"change")
    validationLogic: revalidateLogic(),
    // 必須検証は title の AppField validator が保存前に強制する。ここでは
    // noteInputSchema の trim と同じ正規化だけ先に済ませ、送信値と保存値を一致させる。
    // Promise を返すので form.handleSubmit() の Promise が mutation の決着まで続く
    onSubmit: ({ value }) => onSubmit({ title: value.title.trim(), body: value.body }),
  });

  return (
    // 検証に失敗すると handleSubmit は onSubmit を呼ばずに resolve し、Transition もすぐ終わる
    <ActionForm className={dialogScrollLayout} submitAction={() => form.handleSubmit()}>
      <DialogScrollBody>
        <FieldGroup>
          {/* validator は server function と同じ noteInputSchema の項目定義を使う。
              別に書くと「画面は通るが保存で弾かれる」ずれが生まれる */}
          <form.AppField name="title" validators={{ onDynamic: noteInputSchema.entries.title }}>
            {(field) => (
              <field.FormTextField
                label={NOTE_FIELD_LABELS.title}
                fieldValue={field.state.value}
                placeholder="買い物リスト"
              />
            )}
          </form.AppField>
          <form.AppField name="body" validators={{ onDynamic: noteInputSchema.entries.body }}>
            {(field) => (
              <field.FormTextField
                label={NOTE_FIELD_LABELS.body}
                fieldValue={field.state.value}
                placeholder="牛乳とパンを買う"
              />
            )}
          </form.AppField>
        </FieldGroup>
      </DialogScrollBody>
      <DialogFooter>
        <DialogClose disabled={blocksClose} render={<Button type="button" variant="outline" />}>
          キャンセル
        </DialogClose>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </DialogFooter>
    </ActionForm>
  );
}
