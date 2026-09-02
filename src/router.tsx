import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { NotFoundContent } from "@/components/not-found";
import { RouteErrorContent } from "@/components/route-error";
import { toast } from "@/components/ui/toast";
import { createBackgroundRefetchErrorHandler } from "@/lib/query-cache-handlers";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // mutation 成功後の一覧 refetch 失敗 (background refetch) が無通知で古いデータを残す
  // silent failure を防ぐ。初回ロード失敗は error boundary (RouteErrorContent) が扱うため
  // 二重通知を避けてハンドラ側で除外する (詳細: query-cache-handlers.ts)。
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      // stable id で background refetch 失敗の toast を 1 つに collapse する
      // (複数クエリ / ナビゲーション毎の stale prefetch 失敗が積み上がらないように)
      onError: createBackgroundRefetchErrorHandler((message) =>
        toast.add({ type: "error", title: message, id: "background-refetch-error" }),
      ),
    }),
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 500,
    defaultPendingMinMs: 200,
    // loader / useSuspenseQuery のエラーを失敗 route の境界で受ける (周囲のレイアウトを
    // 保ったまま日本語 UI + 再試行を出す。未設定だと SSR は英語の組み込み UI、client は
    // root の全画面エラーに落ちる)
    defaultErrorComponent: RouteErrorContent,
    defaultNotFoundComponent: NotFoundContent,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
