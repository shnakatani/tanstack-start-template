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
import { useState, type ReactNode } from "react";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { APP_NAME } from "@/lib/app-name";
import { pageTitle } from "@/lib/page-title";
import { readAnnouncements } from "@/test/assert/live-announcer";

import { RouteAnnouncer } from "./route-announcer";
import { RouterInnerWrap } from "./router-inner-wrap";

// 遷移は history の API で起こす。history は path の型を持たないので、アプリの route tree に依存しない。
// 確かめる対象は遷移の伝え方で、遷移の引き金ではない
function createAnnouncedRouter(
  options: {
    rootThrowsAt?: string;
    innerWrap?: typeof RouterInnerWrap;
  } = {},
) {
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
    component: () => (
      <>
        <h1>B</h1>
        <Outlet />
      </>
    ),
  });
  // ページ (/b) の上に重ねるダイアログの route
  const bDialog = createRoute({
    getParentRoute: () => b,
    path: "dialog",
    staticData: { dialogRoute: true },
    component: () => <p>ダイアログ</p>,
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
  // notFound({ routeId: rootRouteId }) で root を境界に指定する。/missing は head を持たないので、
  // title は root の pageTitle(ctx) からしか来ない。not found の判定を通らなければ APP_NAME になる
  const missing = createRoute({
    getParentRoute: () => rootRoute,
    path: "/missing",
    loader: () => {
      throw notFound({ routeId: rootRouteId });
    },
  });
  // 自分の notFoundComponent を持つ子 route が境界になる。/gone の head は自分のページ名を渡すので、
  // 判定を通らなければ「Gone — アプリ名」になる
  const gone = createRoute({
    getParentRoute: () => rootRoute,
    path: "/gone",
    loader: () => {
      throw notFound();
    },
    head: (ctx) => ({ meta: [{ title: pageTitle(ctx, "Gone") }] }),
    component: () => <h1>Gone</h1>,
    notFoundComponent: () => <h1>項目が見つかりません</h1>,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([a, b.addChildren([bDialog]), err, missing, gone]),
    history: createMemoryHistory({ initialEntries: ["/a"] }),
    // 本番 (src/router.tsx) と同じ配線を通す
    InnerWrap: options.innerWrap ?? RouterInnerWrap,
    defaultViewTransition: true,
    defaultPendingMinMs: 0,
  });
}

it("最初のページでは focus を動かさず、読み上げない", async () => {
  const screen = await render(<RouterProvider router={createAnnouncedRouter()} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  expect(document.activeElement).toBe(document.body);
  // 後に出る通知が無いので、見出しが描かれた後に 1 回読む
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
  // location は load の開始時に変わる。onRendered は resolvedLocation を設定する batch の中で出るので、そちらを待つ
  await expect.poll(() => router.state.resolvedLocation?.searchStr).toBe("?q=x");
  await expect.element(searchButton).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("子 route のエラー画面へ移ると、エラー画面の h1 へ移す", async () => {
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
  // focus だけを見る。テストの root の errorComponent は HeadContent を持たず、title が変わらない
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

it("子 route が受け持つ notFound へ移っても、not found の title を読み上げる", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  router.history.push("/gone");
  await expect.element(screen.getByRole("heading", { name: "項目が見つかりません" })).toHaveFocus();
  expect(readAnnouncements()).toEqual([`ページが見つかりません — ${APP_NAME}`]);
});

it("RouteAnnouncer が外れた後の遷移では、focus を動かさず読み上げない", async () => {
  // InnerWrap は router と同じ寿命なので、RouteAnnouncer だけを外せる InnerWrap を組む
  // SSR を通らないテスト専用なので、InnerWrap の中に DOM (button) を描いてよい
  function DetachableInnerWrap({ children }: { children: ReactNode }) {
    const [attached, setAttached] = useState(true);
    return (
      <>
        {attached && <RouteAnnouncer />}
        <button type="button" onClick={() => setAttached(false)}>
          読み上げを外す
        </button>
        {children}
      </>
    );
  }
  const router = createAnnouncedRouter({ innerWrap: DetachableInnerWrap });
  const screen = await render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("button", { name: "読み上げを外す" }));
  const button = screen.getByRole("button", { name: "B へ" });
  await userEvent.click(button);
  await expect.element(screen.getByRole("heading", { name: "B" })).toBeInTheDocument();
  await expect.poll(() => router.state.status).toBe("idle");
  await expect.element(button).toHaveFocus();
  expect(readAnnouncements()).toEqual([]);
});

it("ページの上のダイアログの route を開閉しても、focus を動かさず読み上げない", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("button", { name: "B へ" }));
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();
  // 開いたトリガーに focus がある場面を作る。伝えると、覚えた要素のままなので見出しへ移る
  const opener = screen.getByRole("button", { name: "検索" });
  opener.element().focus();

  router.history.push("/b/dialog");
  await expect.element(screen.getByText("ダイアログ")).toBeInTheDocument();
  await expect.poll(() => router.state.resolvedLocation?.pathname).toBe("/b/dialog");
  await expect.element(opener).toHaveFocus();

  router.history.back();
  await expect.poll(() => router.state.resolvedLocation?.pathname).toBe("/b");
  await expect.element(opener).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`]);
});

it("ダイアログの route から別のページへ移ると、見出しへ移して読み上げる", async () => {
  const router = createAnnouncedRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect.element(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();

  // 別のページからダイアログを直接開くと、ページが変わるので伝える
  router.history.push("/b/dialog");
  await expect.element(screen.getByRole("heading", { name: "B" })).toHaveFocus();

  router.history.push("/a");
  await expect.element(screen.getByRole("heading", { name: "A" })).toHaveFocus();
  expect(readAnnouncements()).toEqual([`B — ${APP_NAME}`, APP_NAME]);
});
