import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { PendingContent } from "@/components/screens/pending";
import { toast } from "@/components/ui/toast";
import { createBackgroundRefetchErrorHandler } from "@/lib/query-cache-handlers";
import {
  createDefaultViewTransition,
  type RouteDialogMatchSource,
} from "@/lib/route-dialog-view-transition";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // mutation 成功後の一覧 refetch 失敗 (background refetch) が無通知で古いデータを残す
  // silent failure を防ぐ。通知する条件は query-cache-handlers.ts が持つ。
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      // stable id で background refetch 失敗の toast を 1 つに collapse する
      // (複数クエリの失敗が積み上がらないように)
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
    // ナビゲーションを View Transitions のクロスフェードにする。飛ばす遷移と type を足す遷移は
    // createDefaultViewTransition が決める (ADR-0040、ADR-0041)。
    // サーバーでは判定せず true を渡す (View Transition はサーバーでは動かない。ADR-0040)
    defaultViewTransition:
      typeof window === "undefined" ? true : createDefaultViewTransition(window, currentRouter),
    // どの route にも当たらない URL は、ページの下の URL も含めて root の notFoundComponent が受ける。既定の
    // fuzzy では、子を持つページが境界になり、ページの <Outlet /> の中に出る。
    // エラーの部品の既定は置かない。置くと、どの route もその部品で境界を張り、部品を置いた祖先へ失敗が上がらない。
    // not found の部品の既定も置かない。not found の最後の受け手は root の notFoundComponent が担う (ADR-0044)
    notFoundMode: "root",
    // route の pendingComponent が無いときの Suspense の受け皿。未設定だと境界が張られず、
    // suspend が root の Outlet まで巻き上がって何も描かれない (ADR-0029)
    defaultPendingComponent: PendingContent,
    // root route の error boundary の外で router を購読する部品 (遷移の読み上げなど) と Provider を置く 1 か所
    InnerWrap: RouterInnerWrap,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;

  // types の関数が遷移の時点で router を読む。router 自身の初期化子から参照するので、戻り値の型を注釈した
  // 関数宣言で受ける。推論させると router の型が自分の初期化子に依存する
  function currentRouter(): RouteDialogMatchSource {
    return router;
  }
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
