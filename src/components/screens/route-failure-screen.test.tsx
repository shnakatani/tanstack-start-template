import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { expectAbsent } from "@/test/assert/absent";

import { NotFoundContent } from "./not-found";
import { RouteErrorContent } from "./route-error";
import { RoutePageHeader } from "./route-page-header";

/**
 * 失敗の画面を、本番と同じ既定の errorComponent と notFoundComponent を置いた route tree で描く。
 * `/items` は名前の付いたページで、子を持つ。router-core は子を持つ最も深い route を未一致の URL の境界にするので
 * (`findGlobalNotFoundRouteId`)、`/items/<未定義>` の not found は `/items` の `<Outlet />` の中に出る
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
        <Outlet />
      </>
    ),
  });
  // ダイアログの形の errorComponent を書き忘れたダイアログの route。既定の errorComponent が背後のページの
  // <Outlet /> の位置に出る
  const itemCreateRoute = createRoute({
    getParentRoute: () => itemsRoute,
    path: "/new",
    staticData: { pageName: "項目を追加", routeDialog: true },
    loader: () => {
      throw new Error("ダイアログの読み込みの失敗");
    },
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
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([
      itemsRoute.addChildren([itemCreateRoute]),
      brokenRoute,
      throwsRoute,
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
      scene: "ページの <Outlet /> の中の not found",
      path: "/items/missing",
      h1: "項目一覧",
      h2: "ページが見つかりません",
    },
    {
      scene: "既定の errorComponent で落ちたダイアログの route",
      path: "/items/new",
      h1: "項目一覧",
      h2: "エラーが発生しました",
    },
  ])("$scene では、ページの名前の h1 が 1 つで、失敗の見出しは h2", async ({ path, h1, h2 }) => {
    // React と router は描画中の throw と route の失敗を console.error に出す。期待した失敗なので出力を抑える
    vi.spyOn(console, "error").mockImplementation(() => {});
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
      scene: "root の beforeLoad の失敗",
      path: "/items",
      h1: "エラーが発生しました",
      rootBeforeLoadThrows: true,
    },
  ])(
    "$scene では、失敗の見出しが h1 で、見出しの行を描かない",
    async ({ path, h1, rootBeforeLoadThrows }) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const screen = await renderFailure(path, { rootBeforeLoadThrows });

      await expect.element(screen.getByRole("heading", { name: h1, level: 1 })).toBeInTheDocument();
      await expect.element(screen.getByRole("heading", { level: 1 })).toHaveLength(1);
      await expectAbsent(screen.getByRole("heading", { level: 2 }));
    },
  );
});
