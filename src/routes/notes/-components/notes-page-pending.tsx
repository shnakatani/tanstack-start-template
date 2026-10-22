import { PageHeader } from "@/components/parts/page-header";

import { NOTES_PAGE_TITLE } from "../-lib/notes-page-constants";
import { NotesTableSkeleton } from "./notes-table-skeleton";

/**
 * 一覧の pending 表示 (route の `pendingComponent`)。ページ本体 (`notes-page.tsx`) と同じ module に
 * 置かない。`pendingComponent` は plugin の既定では code-split されず route ファイルに残るので、
 * 同じ module から import するとページ本体まで main bundle に引き込まれる (ADR-0010)。
 */
export function NotesPagePending() {
  return (
    <div>
      <PageHeader title={NOTES_PAGE_TITLE} />
      <div className="p-4">
        <NotesTableSkeleton />
      </div>
    </div>
  );
}
