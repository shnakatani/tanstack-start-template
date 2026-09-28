import { NOTE_FIELD_LABELS } from "@/features/notes/schema";

/**
 * 一覧ページの本体 (`notes-page.tsx`) と pending 表示 (`notes-page-pending.tsx`) が共有する値。
 * pending は code-split されず main bundle に入るので、ここにはセルの描画や列定義を import しない (ADR-0010)
 */

/** 一覧ページの見出し */
export const NOTES_PAGE_TITLE = "メモ一覧";

/** 一覧の列の id と見出し。列の順もここが持つ。列定義 (`note-columns.ts`) と `TableSkeleton` の両方がここから採る */
export const NOTE_COLUMN_HEADERS = {
  title: NOTE_FIELD_LABELS.title,
  body: NOTE_FIELD_LABELS.body,
  dueDate: NOTE_FIELD_LABELS.dueDate,
  createdAt: NOTE_FIELD_LABELS.createdAt,
  updatedAt: NOTE_FIELD_LABELS.updatedAt,
  actions: "操作",
} as const;

export type NoteColumnId = keyof typeof NOTE_COLUMN_HEADERS;
