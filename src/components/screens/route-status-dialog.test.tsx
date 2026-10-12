import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
  type AnyRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";

import {
  RoutePendingDialog,
  RouteStatusDialog,
  type RoutePendingDialogProps,
  type RouteStatusDialogProps,
} from "./route-status-dialog";

// 戻り先の型はアプリの router ではなく、この router で検査する。部品の公開の signature と同じく、router の型を
// 型引数の既定にする
function TestStatusDialog<TRouter extends AnyRouter = TestRouter, TOptions = unknown>(
  props: RouteStatusDialogProps<TRouter, TOptions>,
): ReactNode {
  return <RouteStatusDialog<TRouter, TOptions> {...props} />;
}

function TestPendingDialog<TRouter extends AnyRouter = TestRouter, TOptions = unknown>(
  props: RoutePendingDialogProps<TRouter, TOptions>,
): ReactNode {
  return <RoutePendingDialog<TRouter, TOptions> {...props} />;
}

function findCreateButton() {
  return document.querySelector<HTMLElement>("[data-return-mark]");
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items",
  component: ItemsPage,
});
const missingRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/missing",
  staticData: { routeDialog: true },
  component: MissingDialog,
});
const loadingRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/loading",
  staticData: { routeDialog: true },
  component: LoadingDialog,
});

function ItemsPage(): ReactNode {
  return (
    <>
      <h1>項目</h1>
      <button type="button" data-return-mark="">
        項目を追加
      </button>
      <Outlet />
    </>
  );
}

function MissingDialog(): ReactNode {
  return (
    <TestStatusDialog
      title="項目が見つかりません"
      description="削除されたか、URL が誤っています。"
      action={<Button>再試行</Button>}
      returnTo={{ to: "/items" }}
      findReturnTarget={findCreateButton}
    />
  );
}

function LoadingDialog(): ReactNode {
  return (
    <TestPendingDialog
      title="項目を追加"
      returnTo={{ to: "/items" }}
      findReturnTarget={findCreateButton}
    />
  );
}

const routeTree = rootRoute.addChildren([itemsRoute.addChildren([missingRoute, loadingRoute])]);

function createStatusRouter(initialEntries: string[]) {
  return createRouterWithTestDefaults({
    routeTree,
    history: createMemoryHistory({ initialEntries, initialIndex: initialEntries.length - 1 }),
  });
}

type TestRouter = ReturnType<typeof createStatusRouter>;

async function renderStatusRouter(initialEntries: string[]) {
  const router = createStatusRouter(initialEntries);
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

describe("RouteStatusDialog", () => {
  it("見出しと説明をダイアログの名前と説明にし、渡した操作を閉じるの隣に並べる", async () => {
    const { screen } = await renderStatusRouter(["/items/missing"]);

    const dialog = screen.getByRole("dialog", { name: "項目が見つかりません" });
    await expect.element(dialog).toHaveAccessibleDescription("削除されたか、URL が誤っています。");
    await expect.element(dialog.getByRole("button", { name: "閉じる" })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "再試行" })).toBeVisible();
  });

  it("閉じる操作の時点で戻り先へ離れる", async () => {
    const { router, screen } = await renderStatusRouter(["/items/missing"]);

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/items");
  });
});

describe("RoutePendingDialog", () => {
  it("説明を「読み込み中」にし、閉じる操作の時点で戻り先へ離れる", async () => {
    const { router, screen } = await renderStatusRouter(["/items/loading"]);
    await expect
      .element(screen.getByRole("dialog", { name: "項目を追加" }))
      .toHaveAccessibleDescription("読み込み中");

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/items");
  });
});

describe.each([
  { dialog: "RouteStatusDialog", path: "/items/missing" },
  { dialog: "RoutePendingDialog", path: "/items/loading" },
])("$dialog の閉じたときの focus", ({ path }) => {
  it("閉じる操作で閉じたら、開いた元の要素へ focus を移す", async () => {
    const { screen } = await renderStatusRouter([path]);

    await screen.getByRole("button", { name: "閉じる" }).click();

    await expect.element(screen.getByRole("button", { name: "項目を追加" })).toHaveFocus();
  });

  it("戻るで離れたら、開いた元の要素へ focus を戻す", async () => {
    const { router, screen } = await renderStatusRouter(["/items", path]);
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    router.history.back();

    await expect.element(screen.getByRole("button", { name: "項目を追加" })).toHaveFocus();
  });
});
