import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  type StaticDataRouteOption,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { createRouterWithTestDefaults } from "./create-router-with-test-defaults";

/**
 * 単一 route を描くだけの最小 router (TanStack Router の how-to「How to Set Up Testing with Code-Based Routing」の `createTestRouter` と
 * 同じ形: 最小の route + memory history)。`Link` / `useRouter` を使う部品を単体で描画するための
 * 足場で、アプリの router 設定 (`src/router.tsx` の defaultPreload / defaultErrorComponent 等) は
 * **意図的に持たない**。既定値を写すと router.tsx との二重管理になり、片方だけ変えたときに
 * テストだけが古い既定で緑になる。既定値そのものを検証したいテストは router.tsx を直接使う。
 * テスト用の既定だけは、ほかのテストの router と同じく `createRouterWithTestDefaults` で入れる。
 * `staticData` は描く route に付ける。ダイアログの部品を描くなら `{ routeDialog: true }` を渡す
 * (ADR-0041「閉じる遷移の見せ方」)
 */
export function createTestRouter(
  initialPath: string,
  component: () => ReactNode,
  staticData?: StaticDataRouteOption,
) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: initialPath,
    staticData,
    component,
  });
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => null,
  });
  return createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([testRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}
