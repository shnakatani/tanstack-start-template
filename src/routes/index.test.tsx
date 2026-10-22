import {
  createMemoryHistory,
  createRootRoute,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { APP_NAME } from "@/lib/app-name";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";

import { Route } from "./index";

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と `<html>` を描くので
 * browser test では使えない (docs/guides/testing/real-router.md「route の wrapper をテストする」)。
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

// `update` の公開型は id / path / getParentRoute を持たない (生成コードは `as any` で渡す)。
// 型アサーションを書かずに済むよう、交差型で注釈した変数を渡す
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
    const router = createRouterWithTestDefaults({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await render(<RouterProvider router={router} />);

    await expect.poll(() => document.title).toBe(APP_NAME);
  });

  it("見出しの行にアプリ名を h1 で描く", async () => {
    const router = createRouterWithTestDefaults({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    const screen = await render(<RouterProvider router={router} />);

    await expect
      .element(screen.getByRole("heading", { name: APP_NAME, level: 1 }))
      .toBeInTheDocument();
  });
});
