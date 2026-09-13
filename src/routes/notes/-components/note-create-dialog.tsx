import { revalidateLogic } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { ActionForm, ActionFormSubmit } from "@/components/action/form";
import { DialogScrollBody, dialogScrollLayout } from "@/components/dialog-scroll-body";
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
import { createNote } from "@/features/notes/functions";
import { noteMutationKeys } from "@/features/notes/mutations";
import { notesQueryOptions } from "@/features/notes/queries";
import type { NoteInput } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS, noteInputSchema } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useAppForm } from "@/hooks/use-app-form";
import { toastMutationError } from "@/lib/mutation-error";

/**
 * 追加ボタン (route の PageHeader) と Root (このファイル) を結ぶ detached trigger の handle。
 * Root は 1 handle につき 1 つなので、`NoteCreateDialog` は同時に 1 箇所でだけ描画する。
 */
export const noteCreateDialogHandle = createDialogHandle<undefined>();

/**
 * `Dialog` の `onOpenChange` の型。転送先の props から導出する
 * (`.claude/rules/typing.md`「ラッパー部品の転送 prop 型」)。
 */
type DialogOpenChangeHandler = NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]>;

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
    mutationKey: noteMutationKeys.create,
    mutationFn: (data: NoteInput) => createNote({ data }),
    // 完了点 (b): 応答で閉じ、再取得の Promise を返して pending を再取得完了まで保つ (ADR-0016)。
    // 一覧側は useMutationState でこの pending を読み、新しい行を先に出す。
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる
    onSuccess: () => {
      noteCreateDialogHandle.close();
      return queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey });
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // 保存中はユーザー起点の close (Escape / 外側クリック / X / キャンセル) を止める。閉じて
  // 開き直すと DialogContent がアンマウントされてフォームが作り直され、先行 save の応答が
  // 届いた時点で新しい入力ごと閉じる。handle を複数の対象で共有するダイアログと違い、入力
  // フォームは開いている対象を mutation の対象と比べられないので、閉じないことで塞ぐ
  // (ADR-0016 Decision の完了点 (b) の行)。止めるのはこのダイアログだけで、一覧の操作は
  // 止めない (ADR-0016「ブロック範囲」)
  const handleOpenChange: DialogOpenChangeHandler = (open, details) => {
    // onSuccess の close は handle 経由なので reason が imperative-action になる。通す
    if (!open && createMutation.isPending && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return (
    <Dialog handle={noteCreateDialogHandle} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メモを追加</DialogTitle>
        </DialogHeader>
        {/* pending 表示は ActionFormSubmit が Action 層から取る。ここで mutation の pending を
            渡すのは表示ではなく close の可否で、handleOpenChange と同じ源から取らないと
            「押せるのに閉じない」ずれが出る (`.claude/rules/implementation.md` の pending の項目) */}
        <NoteCreateForm onSubmit={createMutation.runAction} isSaving={createMutation.isPending} />
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
  isSaving,
}: {
  onSubmit: (note: NoteInput) => Promise<void>;
  /** 保存の応答待ちか。キャンセルを無効化して close の阻止 (`handleOpenChange`) と対応させる */
  isSaving: boolean;
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
        <DialogClose disabled={isSaving} render={<Button type="button" variant="outline" />}>
          キャンセル
        </DialogClose>
        <ActionFormSubmit pendingLabel="保存中">保存</ActionFormSubmit>
      </DialogFooter>
    </ActionForm>
  );
}
