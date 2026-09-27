import { revalidateLogic } from "@tanstack/react-form";
import * as v from "valibot";

import { ActionDialogContent } from "@/components/action/dialog";
import { ActionFormSubmit } from "@/components/action/form";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogScrollBody,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { NOTE_FIELD_LABELS, noteInputSchema } from "@/features/notes/schema";
import type { NoteInput } from "@/features/notes/schema";
import { useAppForm } from "@/hooks/use-app-form";

/**
 * 入力フォームとそれを包むダイアログの中身。submit にフォームの状態が要るので、見出しを含む
 * `ActionDialogContent` ごとここで描く。
 *
 * フィールドに `autoFocus` は渡さない — base-ui の Popup が既定でポップアップ内の最初の
 * tabbable へフォーカスを移し、タッチ操作のときだけ仮想キーボードを開かないよう Popup
 * 自身を選ぶ。`autoFocus` はこの出し分けを潰す (初期フォーカス位置は
 * `note-create-dialog.test.tsx` が固定している)。
 */
export function NoteFormContent({
  heading,
  defaultValues,
  onSubmit,
  blocksClose,
}: {
  /** ダイアログの見出し (「メモを追加」/「メモを編集」) */
  heading: string;
  /** フォームの初期値。作成は空、編集は今の値 */
  defaultValues: NoteInput;
  onSubmit: (note: NoteInput) => Promise<void>;
  /** 保存の応答待ちで close を止めている間か。キャンセルも同じ源で無効化して見た目と挙動を揃える */
  blocksClose: boolean;
}) {
  const form = useAppForm({
    defaultValues,
    // 初回 submit までは検証エラーを表示せず、submit 後は変更毎に再検証する
    // (revalidateLogic のデフォルト: mode:"submit", modeAfterSubmission:"change")
    validationLogic: revalidateLogic(),
    // TanStack Form は validator のスキーマの変換 (title の trim) を value に反映しない。
    // 送信前にスキーマへ通し、送信値と保存値を一致させる。各項目は同じスキーマで検証済みなので、
    // ここで throw するのは項目の validator とスキーマがずれたときだけ。
    // Promise を返すので form.handleSubmit() の Promise が mutation の決着まで続く
    onSubmit: ({ value }) => onSubmit(v.parse(noteInputSchema, value)),
  });

  return (
    // 検証に失敗すると handleSubmit は onSubmit を呼ばずに resolve し、Transition もすぐ終わる
    <ActionDialogContent submitAction={() => form.handleSubmit()}>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
      </DialogHeader>
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
          <form.AppField name="dueDate" validators={{ onDynamic: noteInputSchema.entries.dueDate }}>
            {(field) => (
              <field.FormDateField
                label={NOTE_FIELD_LABELS.dueDate}
                emptyText={`${NOTE_FIELD_LABELS.dueDate}なし`}
                fieldValue={field.state.value}
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
    </ActionDialogContent>
  );
}
