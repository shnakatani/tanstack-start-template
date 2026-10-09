import { queryOptions } from "@tanstack/react-query";

import { getNote, listNotes } from "./functions";
import type { Note, NoteListFilter } from "./schema";

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

/** 絞り込み条件ごとの一覧クエリ。条件は先頭キーの後ろに継ぎ足す (`docs/guides/lists-and-search.md`「絞り込み条件を URL に置く」)。 */
export function notesQueryOptions(filter: NoteListFilter) {
  return queryOptions({
    queryKey: [...NOTES_QUERY_KEY, filter],
    queryFn: () => listNotes({ data: filter }),
    staleTime: NOTES_STALE_TIME_MS,
  });
}

/**
 * 1 件のクエリの先頭キー。一覧の `NOTES_QUERY_KEY` の下に置かない。下に置くと、保存後の一覧の
 * invalidate が前方一致で当たり、閉じかけの編集ダイアログの 1 件まで取り直す。開くときの取り直しは
 * 編集の route の loader が持つ
 */
export const NOTE_QUERY_KEY = ["note"] as const;

/**
 * 1 件のクエリ。編集フォームの初期値に使う。フォームは開いた時点の値で作り、開いている間に裏で
 * 取り直しても追わないので、observer の再取得を止める (TkDodo「React Query and Forms」)。
 * 開くときの取り直しは route の loader が `staleTime: 0` で行う
 */
export function noteQueryOptions(id: Note["id"]) {
  return queryOptions({
    queryKey: [...NOTE_QUERY_KEY, id],
    queryFn: () => getNote({ data: { id } }),
    staleTime: Infinity,
  });
}
