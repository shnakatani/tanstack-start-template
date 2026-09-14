import { createColumnHelper } from "@tanstack/react-table";

import { actionDisabledAppearance } from "@/components/action/button";
import { type DataTableFeatures } from "@/components/data-table-features";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { NoteRow, SavedNoteRow } from "@/features/notes/note-rows";
import type { NoteInput } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { formatDateTime } from "@/lib/format-date-time";

import { noteDeleteDialogHandle } from "./note-delete-dialog";

const helper = createColumnHelper<DataTableFeatures, NoteRow>();

/** 入力項目 (title / body) がどちらの行にも載っている場所。テキスト列はここから読む */
function noteInputOf(row: NoteRow): NoteInput {
  return row.kind === "saved" ? row.note : row.variables;
}

/** メモ一覧の列定義 (ADR-0019)。`TableSkeleton` の列数もここから採る。 */
export const noteColumns = helper.columns([
  helper.accessor((row) => noteInputOf(row).title, {
    id: "title",
    header: NOTE_FIELD_LABELS.title,
  }),
  helper.accessor((row) => noteInputOf(row).body, {
    id: "body",
    header: NOTE_FIELD_LABELS.body,
    meta: { cellClassName: "max-w-xs truncate" },
  }),
  helper.display({
    id: "createdAt",
    header: NOTE_FIELD_LABELS.createdAt,
    cell: ({ row }) => {
      if (row.original.kind !== "saved") {
        // 作成日時はまだ無いので、その位置で保存中を伝える。行の aria-busy が true の間は
        // 支援技術が内容の変化を無視してよい (WAI-ARIA 1.2 aria-busy) ので、このテキストは
        // 仮想カーソルで行を読んだとき用。通知は announcer (ADR-0017)
        return "保存中";
      }
      // 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の整形は
      // SSR と hydration で文字列が食い違う (format-date-time.ts)
      return formatDateTime(row.original.note.createdAt);
    },
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
