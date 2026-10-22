import { useRouter } from "@tanstack/react-router";

import { useResetQueryErrorsOnShow } from "./use-reset-query-errors-on-show";

/**
 * route の errorComponent の再試行。ページの形 (`RouteErrorContent`) でもダイアログの形でも、
 * errorComponent は再試行のハンドラをここから取る。再試行は `router.invalidate()` だけを呼び、表示した時点で Query の
 * error boundary を reset する (`useResetQueryErrorsOnShow`)。しないと、loader が取得しない `useSuspenseQuery` の
 * 失敗が Query のキャッシュに残り、再試行で回復しない (docs/guides/data-loading.md「読み込みに失敗した画面から再試行する」)
 */
export function useRouteRetry(): () => void {
  const router = useRouter();
  useResetQueryErrorsOnShow();

  // 再実行の結果は loader と error boundary が受けるため待たない
  function handleRetry() {
    void router.invalidate();
  }

  return handleRetry;
}
