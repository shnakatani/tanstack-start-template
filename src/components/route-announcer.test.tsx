import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  notFound,
  Outlet,
  RouterProvider,
  rootRouteId,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { APP_NAME } from "@/lib/app-name";
import { pageTitle } from "@/lib/page-title";
import { readAnnouncements } from "@/test/assert/live-announcer";

import { RouteAnnouncer } from "./route-announcer";

// 遷移は history の API で起こす。history は path の型を持たないので、アプリの route tree に依存しない。
// 確かめる対象は遷移の伝え方で、遷移の引き金ではない
function createAnnouncedRouter(options: { rootThrowsAt?: string } = {}) {
  // root の描画が遷移先の pathname で throw するので、root の errorComponent に置き換わる
  function RootComponent() {
    const { pathname } = useLocation();
    const router = useRouter();
    if (pathname === options.rootThrowsAt) {
      throw new Error("root");
    }
    return (
      <>
        <HeadContent />
        {/* 遷移後も残る場所に置き、押した要素に focus が残る場面を作る */}
        <nav>
          <button type="button" onClick={() => router.history.push("/b")}>
            B へ
          </button>
          <button type="button" onClick={() => router.history.push("/b?q=x")}>
            検索
          </button>
        </nav>
        <Outlet />
      </>
    );
  }
  const rootRoute = createRootRoute({
    head: (ctx) => ({ meta: [{ title: pageTitle(ctx) }] }),
    component: RootComponent,
    errorComponent: () => <h1>root のエラー</h1>,
    notFoundComponent: () => <h1>ページが見つかりません</h1>,
  });
  const a = createRoute({
    getParentRoute: () => rootRoute,
    path: "/a",
    component: () => <h1>A</h1>,
  });
  const b = createRoute({
    getParentRoute: () => rootRoute,
    path: "/b",
    head: (ctx) => ({ meta: [{ title: pageTitle(ctx, "B") }] }),
    component: () => <h1>B</h1>,
  });
  const err = createRoute({
    getParentRoute: () => rootRoute,
    path: "/err",
    loader: () => {
      throw new Error("loader");
    },
    head: (ctx) => ({ meta: [{ title: pageTitle(ctx, "Err") }] }),
    errorComponent: () => <h1>エラーが発生しました</h1>,
  });
  // notFound({ routeId: rootRouteId }) で root を境界に指定する。root は独自の
  // head を持たない子 route を挟んでも matches に error を持つので、pageTitle(ctx) だけで
  // not found の title になることを読み上げのテストで確かめる
  const missing = createRoute({
    getParentRoute: () => rootRoute,
    path: "/missing",
    loader: () => {
      throw notFound({ routeId: rootRouteId });
    },
  });
  return createRouter({
    routeTree: rootRoute.addChildren([a, b, err, missing]),
    history: createMemoryHistory({ initialEntries: ["/a"] }),
    InnerWrap: RouteAnnouncer,
    defaultPendingMinMs: 0,
  });
}

it("最初のページでは focus を動かさず、読み上げない", async () => {
  const screen = await render(<RouterProvider router={createAnnouncedRouter()} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  expect(document.activeElement).toBe(document.body);
  expect(readAnnouncements()).toEqual([]);
});

it("残るボタンで遷移すると、新しいページの h1 へ focus を移し、title を読み上げる", async () => {
  const screen = await render(<RouterProvider router={createAnnouncedRouter()} />);
  await userEvent.click(screen.getByRole("button", { name: "B へ" }));
  const heading = screen.getByRole("heading", { name: "B" });
  await expect.element(heading).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("戻る (history の traverse) でも h1 へ移す", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("button", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();
  router.history.back();
  await expect.element(screen.getByRole("heading", { name: "A" })).toHaveFocus();
});

it("検索条件だけの変化では focus を動かさず、読み上げない", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("button", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();
  const searchButton = screen.getByRole("button", { name: "検索" });
  await userEvent.click(searchButton);
  await expect.poll(() => router.state.location.searchStr).toBe("?q=x");
  await expect.element(searchButton).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("ルートのエラー画面へ移ると、エラー画面の h1 へ移す", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  router.history.push("/err");
  await expect.element(screen.getByRole("heading", { name: "エラーが発生しました" })).toHaveFocus();
  expect(readAnnouncements()).toEqual([`Err — ${APP_NAME}`]);
});

it("root のエラー画面に置き換わっても購読は外れず、root のエラー画面の h1 へ移す", async () => {
  const screen = await render(
    <RouterProvider router={createAnnouncedRouter({ rootThrowsAt: "/b" })} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "root のエラー" })).toHaveFocus();
});

it("root が受け持つ notFound へ移ると、not found の title を読み上げる", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  router.history.push("/missing");
  await expect
    .element(screen.getByRole("heading", { name: "ページが見つかりません" }))
    .toHaveFocus();
  expect(readAnnouncements()).toEqual([`ページが見つかりません — ${APP_NAME}`]);
});
