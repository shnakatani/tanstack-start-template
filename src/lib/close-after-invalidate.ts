import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * mutation の `onSuccess` に渡す「再取得を await してからポップアップを閉じる」関数を作る
 * (ADR-0014「mutation の書き方」)。
 *
 * 先に閉じると pending 表示ごとダイアログが消え、古い一覧が pending なしで見える。
 * close は Base UI の store 更新 (緊急更新) なので、`invalidateQueries` の決着を待ってから呼ぶ。
 * `mutateAsync` は `onSuccess` の Promise を待つため、この順序で Transition も再取得完了まで続く。
 */
export function closeAfterInvalidate(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  queryKey: QueryKey,
  popup: { close: () => void },
): () => Promise<void> {
  return async () => {
    await queryClient.invalidateQueries({ queryKey });
    popup.close();
  };
}
