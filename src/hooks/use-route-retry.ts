import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * route の errorComponent の再試行。再試行は `router.invalidate()` だけを呼び、表示した時点で Query の
 * error boundary を reset する。しないと、loader が取得しない `useSuspenseQuery` の失敗が Query の
 * キャッシュに残り、再試行で回復しない (docs/guides/data-loading.md「読み込みに失敗した画面から再試行する」)
 */
export function useRouteRetry(): () => void {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  // 再実行の結果は loader と error boundary が受けるため待たない
  function handleRetry() {
    void router.invalidate();
  }

  return handleRetry;
}
