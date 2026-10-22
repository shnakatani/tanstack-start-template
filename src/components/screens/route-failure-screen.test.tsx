import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  notFound,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { dialogRouteOptions } from "@/lib/page-title";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { expectAbsent } from "@/test/assert/absent";

import { NotFoundContent } from "./not-found";
import { PageOutlet } from "./page-outlet";
import { RouteErrorContent } from "./route-error";
import { RoutePageHeader } from "./route-page-header";

/**
 * 失敗の画面を、本番と同じ既定の errorComponent と notFoundComponent を置いた route tree で描く。
 * `/items` は名前の付いたページで、子を `PageOutlet` で描く。router-core は子を持つ最も深い route を未一致の URL の
 * 境界にするので (`findGlobalNotFoundRouteId`)、`/items/<未定義>` の not found は `/items` の `PageOutlet` の中に出る。
 * `/missing-item` は loader が `notFound()` を投げる名前の付いたページで、not found はその component を置き換えて出る。
 * `/vanishing-item` は描画中に `notFound()` を投げる名前の付いたページで、同じく component を置き換えて出る。
 * `/groups` は `<Outlet />` だけを描く名前の無いレイアウト、`/sections` は同じ形の名前の付いたレイアウトで、
 * どちらも子を持つので `/<レイアウト>/<未定義>` の境界になる
 */
function renderFailure(initialPath: string, { rootBeforeLoadThrows = false } = {}) {
  const rootRoute = createRootRoute({
    beforeLoad: () => {
      if (rootBeforeLoadThrows) {
        throw new Error("root の beforeLoad の失敗");
      }
    },
    component: () => <Outlet />,
    errorComponent: RouteErrorContent,
  });
  const itemsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/items",
    staticData: { pageName: "項目一覧" },
    component: () => (
      <>
        <RoutePageHeader />
        <PageOutlet />
      </>
    ),
  });
  // ダイアログの形の errorComponent を書き忘れたダイアログの route。既定の errorComponent が背後のページの
  // PageOutlet の位置に出る
  const itemCreateRoute = createRoute({
    getParentRoute: () => itemsRoute,
    path: "/new",
    staticData: dialogRouteOptions("項目を追加").staticData,
    loader: () => {
      throw new Error("ダイアログの読み込みの失敗");
    },
  });
  const groupsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/groups",
    component: () => <Outlet />,
  });
  const groupsIndexRoute = createRoute({
    getParentRoute: () => groupsRoute,
    path: "/",
    staticData: { pageName: "グループ一覧" },
    component: () => <RoutePageHeader />,
  });
  // レイアウトは h1 を描かないので、子を PageOutlet でなく <Outlet /> で描く
  const sectionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sections",
    staticData: { pageName: "区画" },
    component: () => <Outlet />,
  });
  const sectionsIndexRoute = createRoute({
    getParentRoute: () => sectionsRoute,
    path: "/",
    staticData: { pageName: "区画一覧" },
    component: () => <RoutePageHeader />,
  });
  const brokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/broken",
    staticData: { pageName: "読めない一覧" },
    loader: () => {
      throw new Error("loader の失敗");
    },
  });
  const throwsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/throws",
    staticData: { pageName: "描けない一覧" },
    component: () => {
      throw new Error("描画の失敗");
    },
  });
  // router-core は notFoundComponent を持つ最も近い route を notFound() の境界にする (`getNotFoundBoundary`)。
  // router の defaultNotFoundComponent は境界を決めないので、自分の route に置かないと root が受ける
  const missingItemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/missing-item",
    staticData: { pageName: "項目の詳細" },
    loader: () => {
      throw notFound();
    },
    notFoundComponent: NotFoundContent,
  });
  // 描画中の notFound() は、自分の route の notFoundComponent (`CatchNotFound`) が受ける。match の status は
  // success のまま
  const vanishingItemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/vanishing-item",
    staticData: { pageName: "消えた項目" },
    component: () => {
      throw notFound();
    },
    notFoundComponent: NotFoundContent,
  });
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([
      itemsRoute.addChildren([itemCreateRoute]),
      groupsRoute.addChildren([groupsIndexRoute]),
      sectionsRoute.addChildren([sectionsIndexRoute]),
      brokenRoute,
      throwsRoute,
      missingItemRoute,
      vanishingItemRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    // 本番 (`src/router.tsx`) と同じ部品を通す
    defaultErrorComponent: RouteErrorContent,
    defaultNotFoundComponent: NotFoundContent,
  });
  return render(<RouterProvider router={router} />);
}

/** 1 画面の h1 は 1 つ。名前の付いたページの位置で失敗したら、ページの名前を h1 に、失敗を h2 にする (ADR-0035) */
describe("RouteFailureScreen", () => {
  beforeEach(() => {
    // React と router は描画中の throw と route の失敗を console.error に出す。期待した失敗なので出力を抑える
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      scene: "ページの loader の失敗",
      path: "/broken",
      h1: "読めない一覧",
      h2: "エラーが発生しました",
    },
    {
      scene: "ページの描画中の throw",
      path: "/throws",
      h1: "描けない一覧",
      h2: "エラーが発生しました",
    },
    {
      scene: "ページの loader の notFound()",
      path: "/missing-item",
      h1: "項目の詳細",
      h2: "ページが見つかりません",
    },
    {
      scene: "ページの描画中の notFound()",
      path: "/vanishing-item",
      h1: "消えた項目",
      h2: "ページが見つかりません",
    },
    {
      scene: "ページの PageOutlet の中の not found",
      path: "/items/missing",
      h1: "項目一覧",
      h2: "ページが見つかりません",
    },
    {
      scene: "既定の errorComponent で、ページの PageOutlet の中に落ちたダイアログの route",
      path: "/items/new",
      h1: "項目一覧",
      h2: "エラーが発生しました",
    },
    {
      scene: "名前の付いたレイアウトの <Outlet /> の中の not found",
      path: "/sections/missing",
      h1: "区画",
      h2: "ページが見つかりません",
    },
  ])("$scene では、ページの名前の h1 が 1 つで、失敗の見出しは h2", async ({ path, h1, h2 }) => {
    const screen = await renderFailure(path);

    await expect.element(screen.getByRole("heading", { name: h2, level: 2 })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: h1, level: 1 })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it.each([
    {
      scene: "名前の付いたページの無い URL",
      path: "/missing",
      h1: "ページが見つかりません",
      rootBeforeLoadThrows: false,
    },
    {
      scene: "名前の無いレイアウトの <Outlet /> の中の not found",
      path: "/groups/missing",
      h1: "ページが見つかりません",
      rootBeforeLoadThrows: false,
    },
    {
      scene: "root の beforeLoad の失敗",
      path: "/items",
      h1: "エラーが発生しました",
      rootBeforeLoadThrows: true,
    },
  ])(
    "$scene では、失敗の見出しが h1 で、見出しの行を描かない",
    async ({ path, h1, rootBeforeLoadThrows }) => {
      const screen = await renderFailure(path, { rootBeforeLoadThrows });

      await expect.element(screen.getByRole("heading", { name: h1, level: 1 })).toBeInTheDocument();
      await expect.element(screen.getByRole("heading", { level: 1 })).toHaveLength(1);
      await expectAbsent(screen.getByRole("heading", { level: 2 }));
    },
  );
});
