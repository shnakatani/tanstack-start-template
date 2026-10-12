import { linkOptions } from "@tanstack/react-router";

import type { Note } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";

/**
 * 一覧ページの本体 (`notes-page.tsx`) と pending 表示 (`notes-page-pending.tsx`)、一覧の上に重ねるダイアログの
 * route が共有する値。
 * pending は code-split されず main bundle に入るので、ここにはセルの描画や列定義を import しない (ADR-0010)
 */

/** 一覧ページの見出し。一覧の table の名前 (本体の `DataTable` と pending の `TableSkeleton` の caption) にも使う */
export const NOTES_PAGE_TITLE = "メモ一覧";

/** 追加ダイアログの見出しと、追加の route の title のページ名 */
export const NOTE_CREATE_DIALOG_TITLE = "メモを追加";

/** 編集ダイアログの見出しと、編集の route の title のページ名 */
export const NOTE_EDIT_DIALOG_TITLE = "メモを編集";

/**
 * 一覧の上に重ねるダイアログ (追加、編集、その読み込み中・失敗・見つからない) を閉じたときの戻り先。一覧の絞り込み
 * (search) を保つ
 */
export const NOTE_DIALOG_RETURN_TO = linkOptions({ to: "/notes", search: (prev) => prev });

/** 一覧の列の id と見出し。列の順もここが持つ。列定義 (`note-columns.ts`) と `TableSkeleton` の両方がここから採る */
export const NOTE_COLUMN_HEADERS = {
  title: NOTE_FIELD_LABELS.title,
  body: NOTE_FIELD_LABELS.body,
  dueDate: NOTE_FIELD_LABELS.dueDate,
  createdAt: NOTE_FIELD_LABELS.createdAt,
  updatedAt: NOTE_FIELD_LABELS.updatedAt,
  actions: "操作",
} as const satisfies Partial<Record<keyof Note, string>> & { actions: string };
