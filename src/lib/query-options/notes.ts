import { queryOptions } from "@tanstack/react-query";

import { listNotes } from "@/server/functions/notes";

/**
 * 一覧の鮮度窓。Link の intent preload が連続したときの重複フェッチを抑える。route loader は
 * staleTime: "static" で呼ぶため、この値の影響を受けない。mutation 後は invalidateQueries が active query を
 * staleTime に関係なく refetch するため、更新の反映には影響しない。
 */
const NOTES_STALE_TIME_MS = 30_000;

/**
 * queryKey はエンティティ名だけの ["notes"]。invalidateQueries({ queryKey: ["notes"] }) が
 * 前方一致で当たるので、絞り込み条件を足すときは同じ配列の後ろへ継ぎ足す。
 */
export const notesQueryOptions = queryOptions({
  queryKey: ["notes"],
  queryFn: () => listNotes(),
  staleTime: NOTES_STALE_TIME_MS,
});
