import { PageHeader } from "@/components/parts/page-header";
import { TableSkeleton } from "@/components/parts/table-skeleton";

import { noteColumns } from "../-lib/note-columns";
import { NOTES_PAGE_TITLE } from "../-lib/notes-page-title";

/**
 * 一覧の pending 表示 (route の `pendingComponent`)。ページ本体 (`notes-page.tsx`) と同じ module に
 * 置かない。`pendingComponent` は plugin の既定では code-split されず route ファイルに残るので、
 * 同じ module から import するとページ本体まで main bundle に引き込まれる (ADR-0012)。
 */
export function NotesPagePending() {
  return (
    <div>
      <PageHeader title={NOTES_PAGE_TITLE} />
      <div className="p-4">
        <TableSkeleton columns={noteColumns.length} />
      </div>
    </div>
  );
}
