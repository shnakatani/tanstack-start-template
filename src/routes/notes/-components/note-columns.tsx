import { createColumnHelper } from "@tanstack/react-table";

import { actionDisabledAppearance } from "@/components/action/button";
import { type DataTableFeatures } from "@/components/data-table-features";
import type { DeleteTarget } from "@/components/delete-confirm-dialog";
import { AlertDialogTrigger, createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Note, NoteInput } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { formatDateTime } from "@/lib/format-date-time";

/** 確定済みの行 (query の data)。`isDeleting` は pending な削除 mutation の variables から派生する */
type SavedNoteRow = { kind: "saved"; note: Note; isDeleting: boolean };

/** 保存中の行 (pending な追加 mutation の variables)。id と createdAt をまだ持たない */
type CreatingNoteRow = { kind: "creating"; submittedAt: number; input: NoteInput };

/**
 * 一覧の 1 行。確定行と保存中の行を 1 本の配列にして table に渡す。楽観表示は query 側
 * (pending な mutation の variables) で行い、`useOptimistic` に query の data を渡さない
 * (ADR-0014「楽観表示の使い分け」、ADR-0016)。
 */
export type NoteRow = SavedNoteRow | CreatingNoteRow;

const helper = createColumnHelper<DataTableFeatures, NoteRow>();

/** 削除確認ダイアログの detached trigger を Root へ結ぶ handle。Root は 1 つだけ描画する。 */
export const noteDeleteDialogHandle = createAlertDialogHandle<DeleteTarget<Note["id"]>>();

/** 行の React key と table の row id。確定行と保存中の行は別の行で、再取得で入れ替わる */
export function getNoteRowId(row: NoteRow): string {
  return row.kind === "saved" ? `saved-${row.note.id}` : `creating-${row.submittedAt}`;
}

/**
 * 列定義の SSOT。見出しとセルが同じ定義に載るので、列を足すときに片方だけ書き忘れない。
 * `TableSkeleton` の列数もここから採り、pending 表示とのレイアウトシフトを防ぐ。
 */
export const noteColumns = helper.columns([
  helper.accessor((row) => (row.kind === "saved" ? row.note.title : row.input.title), {
    id: "title",
    header: NOTE_FIELD_LABELS.title,
  }),
  helper.accessor((row) => (row.kind === "saved" ? row.note.body : row.input.body), {
    id: "body",
    header: NOTE_FIELD_LABELS.body,
    meta: { cellClassName: "max-w-xs truncate" },
  }),
  helper.display({
    id: "createdAt",
    header: "作成日時",
    cell: ({ row }) =>
      row.original.kind === "saved"
        ? // 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の
          // 整形は SSR と hydration で文字列が食い違う (format-date-time.ts)
          formatDateTime(row.original.note.createdAt)
        : // 作成日時はまだ無いので、その位置で保存中を伝える。行の aria-busy が true の間は
          // 支援技術が内容の変化を無視してよい (WAI-ARIA 1.2 aria-busy) ので、このテキストは
          // 仮想カーソルで行を読んだとき用。通知は announcer (ADR-0017)
          "保存中",
  }),
  helper.display({
    id: "actions",
    header: "操作",
    // 保存中の行は id をまだ持たないので削除トリガーを出さない
    cell: ({ row }) =>
      row.original.kind === "saved" ? <NoteDeleteTrigger row={row.original} /> : null,
  }),
]);

function NoteDeleteTrigger({ row }: { row: SavedNoteRow }) {
  const { note, isDeleting } = row;
  return (
    <>
      {/* 削除中は行から可視の手掛かりが半透明しか出ないので、読み上げ用のテキストを足す。
          位置づけは保存中の行の「保存中」と同じ (ADR-0017) */}
      {isDeleting && <span className="sr-only">削除中</span>}
      <AlertDialogTrigger
        handle={noteDeleteDialogHandle}
        payload={{ id: note.id, name: note.title }}
        render={
          <Button
            variant="destructive"
            size="sm"
            focusableWhenDisabled
            className={actionDisabledAppearance}
          />
        }
        // 行が増えても操作対象が読み上げで分かるようにする。可視ラベル「削除」を
        // 含めることで WCAG 2.5.3 (Label in Name) も満たす
        aria-label={`${note.title}を削除`}
        // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)。render 側の
        // focusableWhenDisabled は閉じたあと Base UI がトリガーへフォーカスを返すとき、
        // native disabled でフォーカスが body へ落ちるのを防ぐ
        // (Trigger の props 型は受けず Button primitive が受ける)
        disabled={isDeleting}
      >
        削除
      </AlertDialogTrigger>
    </>
  );
}
