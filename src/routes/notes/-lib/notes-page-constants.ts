import { NOTE_FIELD_LABELS } from "@/features/notes/schema";

/**
 * 一覧ページの本体 (`notes-page.tsx`) と pending 表示 (`notes-page-pending.tsx`) が共有する値。
 * pending は code-split されず main bundle に入るので、ここにはセルの描画や列定義を import しない (ADR-0010)
 */

/** 一覧ページの見出し */
export const NOTES_PAGE_TITLE = "メモ一覧";

/**
 * 一覧の列見出し (列の順)。列定義 (`note-columns.ts`) の `header` と `TableSkeleton` の `headers` の両方がここから採る。
 * 列定義との長さの一致は型が見る (`note-columns.ts`)
 */
export const NOTE_COLUMN_HEADERS = [
  NOTE_FIELD_LABELS.title,
  NOTE_FIELD_LABELS.body,
  NOTE_FIELD_LABELS.dueDate,
  NOTE_FIELD_LABELS.createdAt,
  NOTE_FIELD_LABELS.updatedAt,
  "操作",
] as const;
