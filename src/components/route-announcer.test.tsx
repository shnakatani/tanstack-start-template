import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Link,
  notFound,
  Outlet,
  RouterProvider,
  rootRouteId,
  useLocation,
} from "@tanstack/react-router";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { APP_NAME } from "@/lib/app-name";
import { pageTitle } from "@/lib/page-title";
import { readAnnouncements } from "@/test/assert/live-announcer";

import { RouteAnnouncer } from "./route-announcer";

// <Link to> は登録済みの routeTree で型検査されるため、実在の / と /notes を使う
function createAnnouncedRouter(options: { rootThrowsAt?: string } = {}) {
  // root の描画が遷移先の pathname で throw するので、root の errorComponent に置き換わる
  function RootComponent() {
    const { pathname } = useLocation();
    if (pathname === options.rootThrowsAt) {
      throw new Error("root");
    }
    return (
      <>
        <HeadContent />
        <nav>
          <Link to="/notes">B へ</Link>
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
    path: "/",
    component: () => <h1>A</h1>,
  });
  const b = createRoute({
    getParentRoute: () => rootRoute,
    path: "/notes",
    validateSearch: (search: Record<string, unknown>) => ({
      q: typeof search.q === "string" ? search.q : "",
    }),
    head: (ctx) => ({ meta: [{ title: pageTitle(ctx, "B") }] }),
    component: () => (
      <>
        <h1>B</h1>
        <Link to="/notes" search={{ q: "x" }}>
          検索
        </Link>
      </>
    ),
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
    history: createMemoryHistory({ initialEntries: ["/"] }),
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

it("残るリンクで遷移すると、新しいページの h1 へ focus を移し、title を読み上げる", async () => {
  const screen = await render(<RouterProvider router={createAnnouncedRouter()} />);
  await userEvent.click(screen.getByRole("link", { name: "B へ" }));
  const heading = screen.getByRole("heading", { name: "B" });
  await expect.element(heading).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("戻る (history の traverse) でも h1 へ移す", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("link", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();
  router.history.back();
  await expect.element(screen.getByRole("heading", { name: "A" })).toHaveFocus();
});

it("検索条件だけの変化では focus を動かさず、読み上げない", async () => {
  const screen = await render(<RouterProvider router={createAnnouncedRouter()} />);
  await userEvent.click(screen.getByRole("link", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();
  const searchLink = screen.getByRole("link", { name: "検索" });
  await userEvent.click(searchLink);
  await expect.element(searchLink).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("ルートのエラー画面へ移ると、エラー画面の h1 へ移す", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  // router.navigate の to は登録済みの routeTree で型検査され /err を受けないので、history から遷移する
  router.history.push("/err");
  await expect.element(screen.getByRole("heading", { name: "エラーが発生しました" })).toHaveFocus();
  expect(readAnnouncements()).toEqual([`Err — ${APP_NAME}`]);
});

it("root のエラー画面に置き換わっても購読は外れず、root のエラー画面の h1 へ移す", async () => {
  const screen = await render(
    <RouterProvider router={createAnnouncedRouter({ rootThrowsAt: "/notes" })} />,
  );
  await userEvent.click(screen.getByRole("link", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "root のエラー" })).toHaveFocus();
});

it("root が受け持つ notFound へ移ると、not found の title を読み上げる", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  // router.navigate の to は登録済みの routeTree で型検査され /missing を受けないので、history から遷移する
  router.history.push("/missing");
  await expect
    .element(screen.getByRole("heading", { name: "ページが見つかりません" }))
    .toHaveFocus();
  expect(readAnnouncements()).toEqual([`ページが見つかりません — ${APP_NAME}`]);
});
