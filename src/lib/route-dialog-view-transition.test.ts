import { createMemoryHistory, createRootRoute, createRoute } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";

import {
  ROUTE_DIALOG_CLOSE_TYPE,
  routeDialogViewTransitionTypes,
  withRouteDialogViewTransitionTypes,
  type RouteDialogMatchSource,
} from "./route-dialog-view-transition";
import { skipViewTransitionAfterUATransition } from "./skip-view-transition-after-ua-transition";

const rootRoute = createRootRoute();
// 開く元のページを layout route に置き、その下に index route とダイアログの route を並べる形
const boardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/board" });
const boardIndexRoute = createRoute({ getParentRoute: () => boardRoute, path: "/" });
const boardNewRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: "/new",
  staticData: { routeDialog: true },
});
const boardEditRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: "/$cardId/edit",
  staticData: { routeDialog: true },
});
// 開く元のページの親に path params がある形
const groupItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/groups/$groupId/items",
});
const groupItemNewRoute = createRoute({
  getParentRoute: () => groupItemsRoute,
  path: "/new",
  staticData: { routeDialog: true },
});
const routeTree = rootRoute.addChildren([
  boardRoute.addChildren([boardIndexRoute, boardNewRoute, boardEditRoute]),
  groupItemsRoute.addChildren([groupItemNewRoute]),
]);

function createTreeRouter(initialPath: string) {
  return createRouterWithTestDefaults({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

/** router が types の関数に渡す形の location */
function parsedLocation(path: string) {
  return createTreeRouter("/").parseLocation(
    createMemoryHistory({ initialEntries: [path] }).location,
  );
}

const dialogMatch = { staticData: { routeDialog: true } } as const;
const pageMatch = { staticData: {} };

function matches(dialogs: number) {
  return [pageMatch, ...Array.from({ length: dialogs }, () => dialogMatch)];
}

describe("routeDialogViewTransitionTypes", () => {
  it.each([
    { shown: 0, next: 0, expected: [] },
    { shown: 0, next: 1, expected: [] },
    { shown: 1, next: 0, expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { shown: 1, next: 1, expected: [] },
    { shown: 2, next: 0, expected: [] },
    { shown: 0, next: 2, expected: [] },
  ])(
    "今の画面に $shown 個、行き先に $next 個のダイアログがあると $expected",
    ({ shown, next, expected }) => {
      expect(routeDialogViewTransitionTypes(matches(shown), matches(next))).toEqual(expected);
    },
  );
});

const location = parsedLocation("/board");

function staticRouter(shown: number, next: number): RouteDialogMatchSource {
  return { state: { matches: matches(shown) }, matchRoutes: () => matches(next) };
}

function popstate(hasUAVisualTransition: boolean): Event {
  return Object.assign(new Event("popstate"), { hasUAVisualTransition });
}

describe("withRouteDialogViewTransitionTypes", () => {
  it("UA の遷移の直後の戻るでダイアログを閉じても、View Transition ごと飛ばす", () => {
    const target = new EventTarget();
    const types = withRouteDialogViewTransitionTypes(
      skipViewTransitionAfterUATransition(target),
      () => staticRouter(1, 0),
    );
    target.dispatchEvent(popstate(true));

    expect(types({ toLocation: location })).toBe(false);
  });

  it("base の type の後ろにダイアログの type を足す", () => {
    const types = withRouteDialogViewTransitionTypes(
      () => ["slide"],
      () => staticRouter(1, 0),
    );

    expect(types({ toLocation: location })).toEqual(["slide", ROUTE_DIALOG_CLOSE_TYPE]);
  });

  it("行き先の照合に失敗したら、警告を残して base の type だけを返す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("照合に失敗");
    const types = withRouteDialogViewTransitionTypes(
      () => [],
      () => ({
        state: { matches: matches(1) },
        matchRoutes: () => {
          throw error;
        },
      }),
    );

    expect(types({ toLocation: location })).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { href: "/board", error });
  });
});

describe("router の match から閉じる遷移を見分ける", () => {
  async function typesFrom(from: string, to: string) {
    const router = createTreeRouter(from);
    await router.load();
    const types = withRouteDialogViewTransitionTypes(
      () => [],
      () => router,
    );
    return types({ toLocation: parsedLocation(to) });
  }

  it.each([
    { from: "/board/new", to: "/board", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/groups/g1/items/new", to: "/groups/g1/items", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/board/new", to: "/groups/g1/items", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/board", to: "/board/new", expected: [] },
    { from: "/board/new", to: "/board/c1/edit", expected: [] },
    { from: "/board", to: "/groups/g1/items", expected: [] },
  ])("$from から $to へ移ると $expected", async ({ from, to, expected }) => {
    expect(await typesFrom(from, to)).toEqual(expected);
  });
});
