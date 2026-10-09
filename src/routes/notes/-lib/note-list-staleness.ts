import type { QueryKey } from "@tanstack/react-query";

import type { Note } from "@/features/notes/schema";

type NoteVersion = Pick<Note, "id" | "updatedAt">;

/**
 * 取り直した 1 件と同じ id の行を持つ一覧のキャッシュのうち、`updatedAt` が違う行があるか。
 * `cachedLists` は `queryClient.getQueriesData` の戻り値 (キーと data の組)。data の無い一覧と、その id の
 * 行を持たない一覧は比べない
 */
export function hasDifferingListRow(
  note: NoteVersion,
  cachedLists: ReadonlyArray<readonly [QueryKey, readonly NoteVersion[] | undefined]>,
): boolean {
  return cachedLists.some(([, rows]) =>
    (rows ?? []).some(
      (row) => row.id === note.id && row.updatedAt.getTime() !== note.updatedAt.getTime(),
    ),
  );
}
