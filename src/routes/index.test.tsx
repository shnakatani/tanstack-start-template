import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { APP_NAME } from "@/lib/app-name";

import { Route } from "./index";

/**
 * root だけ差し替えた route tree (理由は notes/index.test.tsx の同じ testRootRoute)。
 * root に `head()` を持たせないので、`document.title` に出るのはホームの route の `head()` の値だけになる。
 */
const testRootRoute = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
});

// `update` の公開型は id / path / getParentRoute を持たない (理由は notes/index.test.tsx の同じ変数)
const attachment: Parameters<typeof Route.update>[0] & {
  id: string;
  path: string;
  getParentRoute: () => typeof testRootRoute;
} = { id: "/", path: "/", getParentRoute: () => testRootRoute };

const routeTree = testRootRoute.addChildren([Route.update(attachment)]);

describe("/ route", () => {
  it("title をアプリ名にする", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await render(<RouterProvider router={router} />);

    await expect.poll(() => document.title).toBe(APP_NAME);
  });
});
