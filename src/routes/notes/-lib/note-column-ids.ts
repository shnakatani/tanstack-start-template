/**
 * メモ一覧の列の並び。`TableSkeleton` の列数と `noteColumns` の並びはここから採る。
 * pending 表示 (`pendingComponent`) は code-split されず main bundle に入るので、セルの描画を
 * 持つ `note-columns.ts` を import させない (ADR-0010)
 */
export const NOTE_COLUMN_IDS = ["title", "body", "dueDate", "createdAt", "actions"] as const;
