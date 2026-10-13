import { linkOptions } from "@tanstack/react-router";

import type { DataTableColumnBase } from "@/components/parts/data-table-columns";
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

/**
 * 一覧の列の id と見出しと幅 (既定の文字サイズのときの px)。列の順もここが持つ。列定義 (`note-columns.ts`) と `TableSkeleton` の両方がここから採る。
 * 行を開くボタン・日時・操作の列は、中身が 1 行に収まる幅にする。タイトルは折り返し、本文は切り詰めて、全文は行を開いて出す (`note-cells.tsx`)。
 * 行を開くボタンの列も見出しを文字で持つ。空の見出しは axe の empty-table-header に当たる
 */
export const NOTE_COLUMNS = {
  expander: { header: "詳細", size: 56 },
  title: { header: NOTE_FIELD_LABELS.title, size: 200 },
  body: { header: NOTE_FIELD_LABELS.body, size: 200 },
  dueDate: { header: NOTE_FIELD_LABELS.dueDate, size: 112 },
  createdAt: { header: NOTE_FIELD_LABELS.createdAt, size: 152 },
  updatedAt: { header: NOTE_FIELD_LABELS.updatedAt, size: 152 },
  actions: { header: "操作", size: 136 },
} as const satisfies Partial<Record<keyof Note, DataTableColumnBase>> & {
  expander: DataTableColumnBase;
  actions: DataTableColumnBase;
};
