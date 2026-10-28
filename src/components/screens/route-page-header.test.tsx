import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { thrownValueMessage } from "@/lib/thrown-value-message";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { createTestRouter } from "@/test/app/create-test-router";
import { expectText } from "@/test/assert/screen-assertions";

import { RoutePageHeader } from "./route-page-header";

afterEach(() => {
  vi.restoreAllMocks();
});

it("自分の route の pageName を h1 で描き、actions を並べる", async () => {
  const router = createTestRouter(
    "/",
    () => <RoutePageHeader actions={<button type="button">追加</button>} />,
    { pageName: "項目一覧" },
  );
  const screen = await render(<RouterProvider router={router} />);

  await expect
    .element(screen.getByRole("heading", { name: "項目一覧", level: 1 }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
});

// 名前の無いページをアプリ名で描くと、書き忘れが黙って通る
it("route に pageName が無ければ throw し、route の errorComponent が受ける", async () => {
  // React は描画中の throw を console.error に出す。期待した throw なので出力を抑える
  vi.spyOn(console, "error").mockImplementation(() => {});
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <RoutePageHeader />,
    errorComponent: ({ error }) => <p>{thrownValueMessage(error)}</p>,
  });
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<RouterProvider router={router} />);

  await expectText(
    screen,
    "[RoutePageHeader] route の staticData に pageName が無い (match の id: //)",
  );
});
