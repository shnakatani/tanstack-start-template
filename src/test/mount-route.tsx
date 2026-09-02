import { QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRoute,
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "vitest-browser-react";

import { createTestQueryClient } from "@/test/page-helpers";

/**
 * 実 Route (createFileRoute インスタンス) を test 用ルートツリーにマウントして
 * `Route.useSearch` / `Route.useNavigate` を実行カバレッジに乗せるためのハーネス。
 *
 * ページのテストは props を直接渡したコンポーネントを描画して Route hooks を迂回するため、
 * route wrapper 側の search 読み出し・navigate 発行が一切実行されない。このハーネスは
 * wrapper を実 router 上で動かし、
 *   1. URL search param → props 変換 (useSearch)
 *   2. ハンドラ → search param 更新 (useNavigate)
 * の往復を検証する。navigate のキー typo や validateSearch との不整合は wrapper を実行して
 * 初めて顕在化するため、props 直渡しテストでは捕捉できない silent failure を埋める。
 *
 * 仕組み: 実 Route は createFileRoute 経由で path/id を持たない (tsr generator が静的注入するため)。
 * そのため `getParentRoute` と `path` を test root に向けて与え直し、router 初期化時に id/fullPath を
 * 再計算させる。Route.useSearch({ from: this.id }) / useNavigate() は再計算後の id を参照するため、
 * id 値が production と異なっても wrapper のロジック (キー名・schema 整合) はそのまま検証できる。
 *
 * test root は search schema を持たない。production の `__root` に `validateSearch` や
 * search middleware を置いていて、その param が子 Route の `useSearch` へ届くことまで
 * 検証したい場合は、下の rootRoute へ同じ schema と middleware を渡すこと。
 *
 * 注意: 実 Route は module スコープの単一インスタンスのため options を破壊的に更新する。
 * 同一ファイル内の全テストが同じ root へ同じ path で reparent する限り副作用は無く、
 * production の routeTree.gen は test では import しないため本物のツリーを汚染しない。
 */
export async function mountRealRoute({
  route,
  path,
  initialEntry,
  queryClient = createTestQueryClient(),
}: {
  route: AnyRoute;
  path: string;
  initialEntry: string;
  queryClient?: ReturnType<typeof createTestQueryClient>;
}) {
  const rootRoute = createRootRouteWithContext<{
    queryClient: ReturnType<typeof createTestQueryClient>;
  }>()({
    component: undefined,
  });

  // 実 Route の親と path を test root に向け直す。createFileRoute インスタンスは path/id を持たず
  // (tsr generator が静的注入するため)、init 時に親 id + path から id/fullPath を再計算する。
  // update() は UpdatableRouteOptions しか受け付けず getParentRoute/path を弾き、options.path は
  // RoutePathOptions が { path } | { id } の union のため直接代入できない。Object.assign で
  // 両プロパティを書き込む (型アサーション不要)。
  Object.assign(route.options, { getParentRoute: () => rootRoute, path });
  rootRoute.addChildren([route]);

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { queryClient },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}
