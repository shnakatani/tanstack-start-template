import { revalidateLogic } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { useAppForm } from "@/hooks/use-app-form";
import { toastMutationError } from "@/lib/mutation-error";
import type { NoteInput } from "@/lib/notes-schema";
import { NOTE_FIELD_LABELS, noteInputSchema } from "@/lib/notes-schema";
import { notesQueryOptions } from "@/lib/query-options/notes";
import { createNote } from "@/server/functions/notes";

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

  const createMutation = useMutation({
    mutationFn: (data: NoteInput) => createNote({ data }),
    onSuccess: () => {
      // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと保存後の一覧が古いままになる
      void queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey });
      noteCreateDialogHandle.close();
    },
    // 失敗時は閉じない (入力を保ったままリトライできる)。server の raw message は
    // 開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  return (
    <Dialog handle={noteCreateDialogHandle}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メモを追加</DialogTitle>
        </DialogHeader>
        <NoteCreateForm
          isPending={createMutation.isPending}
          onSubmit={(note) => {
            createMutation.mutate(note);
          }}
        />
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
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (note: NoteInput) => void;
}) {
  const initialValues: NoteInput = { title: "", body: "" };

  const form = useAppForm({
    defaultValues: initialValues,
    // 初回 submit までは検証エラーを表示せず、submit 後は変更毎に再検証する
    // (revalidateLogic のデフォルト: mode:"submit", modeAfterSubmission:"change")
    validationLogic: revalidateLogic(),
    onSubmit: ({ value }) => {
      // 必須検証は title の AppField validator が保存前に強制する。ここでは
      // noteInputSchema の trim と同じ正規化だけ先に済ませ、送信値と保存値を一致させる
      onSubmit({ title: value.title.trim(), body: value.body });
    },
  });

  return (
    <form
      className={dialogScrollLayout}
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
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
        <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存"}
        </Button>
      </DialogFooter>
    </form>
  );
}
