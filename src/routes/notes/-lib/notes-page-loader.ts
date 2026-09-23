import type { QueryClient } from "@tanstack/react-query";

import { notesQueryOptions } from "@/features/notes/queries";
import type { NoteListFilter } from "@/features/notes/schema";

/**
 * 一覧 loader 本体。route ファイルから export せず `-lib/` に置く。route の property (loader /
 * component) を route ファイルから export すると main bundle に入り code-split されない
 * (TanStack Router「Rules of Splitting」)。ここに置けば loader だけを呼ぶテストが書ける。
 * 引数は `LoaderFnContext` の構造的部分型で書く。Router の型からは導けない: `typeof Route` は route が
 * この関数から型を推論するので循環し (TS2502)、`LoaderFnContext<..., AnyRoute, ...>` は `context` が
 * `any` に解ける (2026-09-23 に実測)。テストでは最小オブジェクトを渡す。
 * `deps` は `loaderDeps` が search から取り出した絞り込み条件 (ADR-0033)。
 */
export function loadNotesPageData({
  context,
  deps,
}: {
  context: { queryClient: QueryClient };
  deps: NoteListFilter;
}) {
  // staleTime: "static" はこの呼び出しだけに効き、キャッシュがあれば必ずそれを返す
  // (無ければ取得する)。queryOptions 側の staleTime を書き換えると observer の再取得まで
  // 止まるため、上書きは呼び出し側に置く
  return context.queryClient.query({ ...notesQueryOptions(deps), staleTime: "static" });
}
