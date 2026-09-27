/**
 * 一覧ページの本体 (`notes-page.tsx`) と pending 表示 (`notes-page-pending.tsx`) が共有する値。
 * pending は code-split されず main bundle に入るので、ここにはセルの描画や列定義を import しない (ADR-0010)
 */

/** 一覧ページの見出し */
export const NOTES_PAGE_TITLE = "メモ一覧";

/** 一覧の列数。`TableSkeleton` の列数に使う。`noteColumns` の長さと一致することは型が見る (`note-columns.ts`) */
export const NOTE_COLUMN_COUNT = 6;
