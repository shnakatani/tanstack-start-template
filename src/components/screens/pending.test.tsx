import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
  type StaticDataRouteOption,
} from "@tanstack/react-router";
import { use } from "react";
import { expect, it, onTestFinished } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { expectAbsent } from "@/test/assert/absent";

import { PendingContent } from "./pending";

/**
 * 読み込みが終わらない route を、router の既定の pending 表示 (`defaultPendingComponent`) で描く。
 * 既定の pending 表示は、読み込み中の route の Suspense の fallback に出て、その route の match を読む
 */
async function renderPending(staticData?: StaticDataRouteOption) {
  const loading = Promise.withResolvers<undefined>();
  // 決着しないまま残さない。テストの後も router が読み込みを待ち続ける
  onTestFinished(() => loading.resolve(undefined));
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    staticData,
    loader: () => loading.promise,
    component: () => <p>読み込んだ</p>,
  });
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingComponent: PendingContent,
    defaultPendingMs: 0,
  });
  return render(<RouterProvider router={router} />);
}

it("読み込み中であることを status の文言で示し、名前と aria-busy を載せない", async () => {
  const screen = await renderPending();

  const status = screen.getByRole("status");
  await expect.element(status).toHaveTextContent("読み込み中");
  await expect.element(status).toHaveAccessibleName("");
  await expect.element(status).not.toHaveAttribute("aria-busy");
});

it("名前の付いたページの読み込み中は、名前だけの見出しの行を描く", async () => {
  const screen = await renderPending({ pageName: "項目一覧" });

  await expect
    .element(screen.getByRole("heading", { name: "項目一覧", level: 1 }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
});

it("名前の無い route の読み込み中は、見出しの行を描かない", async () => {
  const screen = await renderPending({});

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
});

// route が自分の Suspense を持たない (`wrapInSuspense: false`) と、描画中の suspend は root の <Outlet /> の
// Suspense が受け、既定の pending 表示は root の match を読む。root は名前を持たないので、ページの名前を描かない
it("root の <Outlet /> の fallback に出たときは、見出しの行を描かない", async () => {
  const loading = Promise.withResolvers<undefined>();
  onTestFinished(() => loading.resolve(undefined));
  function SuspendingPage() {
    use(loading.promise);
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
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingComponent: PendingContent,
    defaultPendingMs: 0,
  });
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
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
  const loading = Promise.withResolvers<undefined>();
  onTestFinished(() => loading.resolve(undefined));
  function SuspendingRoot() {
    use(loading.promise);
    return <Outlet />;
  }
  const rootRoute = createRootRoute({ wrapInSuspense: false, component: SuspendingRoot });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    staticData: { pageName: "項目一覧" },
    component: () => <p>読み込んだ</p>,
  });
  const router = createRouterWithTestDefaults({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingComponent: PendingContent,
    defaultPendingMs: 0,
  });
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(screen.getByRole("status")).toHaveTextContent("読み込み中");
  await expectAbsent(screen.getByRole("heading"));
});
