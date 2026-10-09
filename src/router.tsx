import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { NotFoundContent } from "@/components/screens/not-found";
import { PendingContent } from "@/components/screens/pending";
import { RouteErrorContent } from "@/components/screens/route-error";
import { toast } from "@/components/ui/toast";
import { createBackgroundRefetchErrorHandler } from "@/lib/query-cache-handlers";
import { skipViewTransitionAfterUATransition } from "@/lib/skip-view-transition-after-ua-transition";

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
    // ナビゲーションを View Transitions のクロスフェードにし、ブラウザが自分でアニメーションを出した
    // 戻る・進むでは飛ばす。サーバーでは判定せず true を渡す (View Transition はサーバーでは動かない。ADR-0040)
    defaultViewTransition:
      typeof window === "undefined" ? true : { types: skipViewTransitionAfterUATransition(window) },
    // loader / useSuspenseQuery のエラーを失敗 route の境界で受ける (周囲のレイアウトを
    // 保ったまま日本語 UI + 再試行を出す。未設定だと SSR は英語の組み込み UI、client は
    // root の全画面エラーに落ちる)
    defaultErrorComponent: RouteErrorContent,
    defaultNotFoundComponent: NotFoundContent,
    // route の pendingComponent が無いときの Suspense の受け皿。未設定だと境界が張られず、
    // suspend が root の Outlet まで巻き上がって何も描かれない (ADR-0029)
    defaultPendingComponent: PendingContent,
    // root route の error boundary の外で router を購読する部品 (遷移の読み上げなど) と Provider を置く 1 か所
    InnerWrap: RouterInnerWrap,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
