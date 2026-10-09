import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import type { Note } from "@/features/notes/schema";

type NoteVersion = Pick<Note, "id" | "updatedAt">;

/**
 * 一覧のキャッシュに、取り直した 1 件と食い違う行があるか。
 * - latestUpdatedAt: 取り直した 1 件の `updatedAt`。1 件が見つからなかった (削除された) ときは null で、
 *   同じ id の行が残っていれば食い違いとみなす
 * - cachedLists: `queryClient.getQueriesData` の戻り値 (キーと data の組)。data の無い一覧と、その id の
 *   行を持たない一覧は比べない
 */
export function hasDifferingListRow(
  id: Note["id"],
  latestUpdatedAt: Date | null,
  cachedLists: ReadonlyArray<readonly [QueryKey, readonly NoteVersion[] | undefined]>,
): boolean {
  return cachedLists.some(([, rows]) =>
    (rows ?? []).some(
      (row) =>
        row.id === id &&
        (latestUpdatedAt === null || row.updatedAt.getTime() !== latestUpdatedAt.getTime()),
    ),
  );
}

/**
 * 取り直した 1 件が一覧のキャッシュの行と食い違えば、一覧を invalidate して裏で取り直す。しないと、
 * ダイアログは新しい値 (か、見つからないこと)、背後の行は古い値のまま並ぶ。値を一覧のキャッシュへ
 * 書き込まない (ADR-0041)。ダイアログは一覧の取得を待たない
 */
export function invalidateNoteListsIfStale(
  queryClient: QueryClient,
  id: Note["id"],
  latestUpdatedAt: Date | null,
): void {
  // `NOTES_QUERY_KEY` の下には一覧の query だけを置くので、data は一覧の行の配列である
  const cachedLists = queryClient.getQueriesData<Note[]>({ queryKey: NOTES_QUERY_KEY });
  if (!hasDifferingListRow(id, latestUpdatedAt, cachedLists)) {
    return;
  }
  // 進行中の一覧の取得 (保存の後の再取得など) があれば、それを使う。既定の cancelRefetch: true は、
  // 進行中の取得を捨てて同じ一覧を取り直す ("If set to `false`, no refetch will be made if there is
  // already a request running." Query reference「InvalidateOptions」。捨てた取得を待っていた側は、
  // `@tanstack/query-core` 5.104.1 の `Query.fetch` の catch で新しい取得の Promise に乗り換える)
  void queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }, { cancelRefetch: false });
}
