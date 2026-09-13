import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * 完了点 (c) (ADR-0016) を選ぶ機能のための helper。mutation の `onSuccess` に渡すと、
 * 再取得を await してからポップアップを閉じる。2026-09-14 時点でメモ画面は (a)/(b) を
 * 選ぶので消費者は無いが、(c) の形として残す。
 *
 * (c) を選ぶ理由: 先に閉じると pending 表示ごとダイアログが消え、古い一覧が pending なしで見える。
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
