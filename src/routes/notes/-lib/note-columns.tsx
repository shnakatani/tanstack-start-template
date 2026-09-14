import { createColumnHelper } from "@tanstack/react-table";

import { type DataTableFeatures } from "@/components/data-table-features";
import type { NoteRow } from "@/features/notes/note-rows";
import { noteInputOf } from "@/features/notes/note-rows";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { formatDateTime } from "@/lib/format-date-time";

import { NoteDeleteTrigger } from "../-components/note-delete-trigger";

const helper = createColumnHelper<DataTableFeatures, NoteRow>();

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
