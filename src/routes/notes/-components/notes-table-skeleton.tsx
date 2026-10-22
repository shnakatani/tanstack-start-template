import { TableSkeleton } from "@/components/parts/table-skeleton";

import { NOTE_COLUMNS, NOTES_PAGE_TITLE } from "../-lib/notes-page-constants";

/**
 * 一覧の結果の部分の skeleton。ページ本体 (`notes-page.tsx`) と route の `pendingComponent`
 * (`notes-page-pending.tsx`) の両方が使う。`pendingComponent` がページ本体の module を import すると
 * main bundle に引き込まれる (ADR-0010) ので、共有の部品は別 module に置く。
 */
export function NotesTableSkeleton() {
  return <TableSkeleton caption={NOTES_PAGE_TITLE} columns={Object.values(NOTE_COLUMNS)} />;
}
