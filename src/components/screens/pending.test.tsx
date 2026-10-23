import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
  type AnyRoute,
  type StaticDataRouteOption,
} from "@tanstack/react-router";
import { use } from "react";
import { expect, it, onTestFinished } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { expectAbsent } from "@/test/assert/absent";

import { PageOutlet } from "./page-outlet";
import { PendingContent } from "./pending";
import { RoutePageHeader } from "./route-page-header";

/**
 * `buildRouteTree` が組んだ route tree を、router の既定の pending 表示 (`defaultPendingComponent`) で描く。
 * `buildRouteTree` には決着しない `loading` を渡す。route はそれを loader で待つか描画中に `use` し、読み込み中のまま残る
 */
async function renderPendingTree(
  buildRouteTree: (loading: Promise<undefined>) => AnyRoute,
  initialPath = "/",
) {
  const loading = Promise.withResolvers<undefined>();
  // 決着しないまま残さない。テストの後も router が読み込みを待ち続ける
  onTestFinished(() => loading.resolve(undefined));
  const router = createRouterWithTestDefaults({
    routeTree: buildRouteTree(loading.promise),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    defaultPendingComponent: PendingContent,
    defaultPendingMs: 0,
  });
  return render(<RouterProvider router={router} />);
}

/**
 * loader が終わらない route を描く。既定の pending 表示は、読み込み中の route の Suspense の fallback に出て、
 * その route の match を読む
 */
function renderPending(staticData?: StaticDataRouteOption) {
  return renderPendingTree((loading) => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      staticData,
      loader: () => loading,
      component: () => <p>読み込んだ</p>,
    });
    return rootRoute.addChildren([pageRoute]);
  });
}

it("名前の無い route の読み込み中は、status の文言で示し、名前と aria-busy と見出しの行を載せない", async () => {
  const screen = await renderPending();

  const status = screen.getByRole("status");
  await expect.element(status).toHaveTextContent("読み込み中");
  await expect.element(status).toHaveAccessibleName("");
  await expect.element(status).not.toHaveAttribute("aria-busy");
  await expectAbsent(screen.getByRole("heading"));
});

it("名前の付いたページの読み込み中は、名前だけの見出しの行を描く", async () => {
  const screen = await renderPending({ pageName: "項目一覧" });

  await expect
    .element(screen.getByRole("heading", { name: "項目一覧", level: 1 }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
});

// route が自分の Suspense を持たない (`wrapInSuspense: false`) と、描画中の suspend は root の <Outlet /> の
// Suspense が受け、既定の pending 表示は root の match を読む。root は名前を持たないので、ページの名前を描かない
it("root の <Outlet /> の fallback に出たときは、見出しの行を描かない", async () => {
  const screen = await renderPendingTree((loading) => {
    function SuspendingPage() {
      use(loading);
      return <p>読み込んだ</p>;
    }
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      // ページの名前を持たせる。fallback がページの match を読めば、名前の見出しが出る
      staticData: { pageName: "項目一覧" },
      wrapInSuspense: false,
      component: SuspendingPage,
    });
    return rootRoute.addChildren([pageRoute]);
  });

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
});

// 子に名前の付いたページを置く形は規範が禁じるが、ダイアログの route は pageHeadingNameOf が名前を外すので、
// PageOutlet の中かどうかで結果が変わるのはこの形だけになる
it("ページの PageOutlet の中の読み込み中は、見出しの行を描かない", async () => {
  const screen = await renderPendingTree((loading) => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
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
    const itemRoute = createRoute({
      getParentRoute: () => itemsRoute,
      path: "/detail",
      staticData: { pageName: "項目の詳細" },
      loader: () => loading,
      component: () => <p>読み込んだ</p>,
    });
    return rootRoute.addChildren([itemsRoute.addChildren([itemRoute])]);
  }, "/items/detail");

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expect
    .element(screen.getByRole("heading", { name: "項目一覧", level: 1 }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("heading", { level: 1 })).toHaveLength(1);
});

// ダイアログの名前は title にだけ使う。ダイアログの route の pending の書き忘れで既定が出ても、h1 を増やさない
it("ダイアログの route の読み込み中は、見出しの行を描かない", async () => {
  const screen = await renderPending({ pageName: "項目を追加", routeDialog: true });

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
});

// root が自分の Suspense を持たない (`wrapInSuspense: false`) と、root の描画中の suspend は router のいちばん外の
// Suspense (CSR で張られる) が受ける。その fallback はどの match の中にも無いので、既定の pending 表示は match を
// 読めない。throw させずに、名前の無い読み込み中として描く
it("どの match の中にも無い fallback に出たときは、throw せずに見出しの行の無い読み込み中を描く", async () => {
  const screen = await renderPendingTree((loading) => {
    function SuspendingRoot() {
      use(loading);
      return <Outlet />;
    }
    const rootRoute = createRootRoute({ wrapInSuspense: false, component: SuspendingRoot });
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      staticData: { pageName: "項目一覧" },
      component: () => <p>読み込んだ</p>,
    });
    return rootRoute.addChildren([pageRoute]);
  });

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
});
