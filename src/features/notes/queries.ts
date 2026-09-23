import { queryOptions } from "@tanstack/react-query";

import { listNotes } from "./functions";
import type { NoteListFilter } from "./schema";

/**
 * 一覧の鮮度窓。Link の intent preload が連続したときの重複フェッチを抑える。route loader は
 * staleTime: "static" で呼ぶため、この値の影響を受けない。mutation 後は invalidateQueries が active query を
 * staleTime に関係なく refetch するため、更新の反映には影響しない。
 */
const NOTES_STALE_TIME_MS = 30_000;

/**
 * 一覧クエリの先頭キー。mutation の `invalidateQueries({ queryKey: NOTES_QUERY_KEY })` が
 * 前方一致で全ての絞り込み条件に当たる。
 */
export const NOTES_QUERY_KEY = ["notes"] as const;

/** 絞り込み条件ごとの一覧クエリ。条件は先頭キーの後ろに継ぎ足す (ADR-0023)。 */
export function notesQueryOptions(filter: NoteListFilter) {
  return queryOptions({
    queryKey: [...NOTES_QUERY_KEY, filter],
    queryFn: () => listNotes({ data: filter }),
    staleTime: NOTES_STALE_TIME_MS,
  });
}
