import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * 失敗の表示 (route の errorComponent、区画の失敗の表示) が出た時点で、Query の失敗を戻す。戻さないと、
 * 描き直しても `useSuspenseQuery` が Query のキャッシュに残った同じ失敗を投げ直し、取得し直さない
 * (TanStack Router docs「External Data Loading」の Error handling with TanStack Query と同じ形。
 * `docs/guides/data-loading.md`「再試行で Query の error boundary を表示時に reset する理由」)。
 * 戻り値は再試行の時点でもう一度戻す関数。表示中に別の `useSuspenseQuery` が mount すると戻した状態が
 * 取り消されるので、表示時の reset だけでは足りない区画の再試行が呼ぶ (TanStack Query docs「Suspense」の
 * Resetting Error Boundaries は再試行の時点で `reset` する)。route の再試行は `router.invalidate()` が
 * 描き直しを担うので、戻り値を使わない
 */
export function useResetQueryErrorsOnShow(): () => void {
  const { reset } = useQueryErrorResetBoundary();

  useEffect(() => {
    reset();
  }, [reset]);

  return reset;
}
