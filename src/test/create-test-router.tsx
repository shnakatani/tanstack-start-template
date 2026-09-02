import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * 単一 route を描くだけの最小 router。`Link` / `useRouter` を使う部品を単体で描画するための
 * 足場で、アプリの router 設定 (`src/router.tsx` の defaultPreload / defaultErrorComponent 等) は
 * **意図的に持たない**。既定値を写すと router.tsx との二重管理になり、片方だけ変えたときに
 * テストだけが古い既定で緑になる。既定値そのものを検証したいテストは router.tsx を直接使う。
 */
export function createTestRouter(initialPath: string, component: () => ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: initialPath,
    component,
  });
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => null,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([testRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}
