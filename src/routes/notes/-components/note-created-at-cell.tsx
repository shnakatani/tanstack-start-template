import { formatDateTime } from "@/lib/format-date-time";

import type { NoteCellContext } from "../-lib/note-rows";

/** 作成日時の cell。保存中の行はまだ日時を持たないので、その位置で保存中を伝える。 */
export function NoteCreatedAtCell({ row }: NoteCellContext) {
  if (row.original.kind !== "saved") {
    // 行の aria-busy が true の間は支援技術が内容の変化を無視してよい (WAI-ARIA 1.2 aria-busy)
    // ので、このテキストは仮想カーソルで行を読んだとき用。通知は announcer (ADR-0017)
    return "保存中";
  }
  // 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の整形は
  // SSR と hydration で文字列が食い違う (format-date-time.ts)
  return formatDateTime(row.original.note.createdAt);
}
