import { createMemoryHistory, createRootRoute, createRoute } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { createPopstateEvent } from "@/test/app/popstate-event";

import {
  createDefaultViewTransition,
  ROUTE_DIALOG_CLOSE_TYPE,
  routeDialogViewTransitionTypes,
  type RouteDialogMatchSource,
} from "./route-dialog-view-transition";

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
    { shown: 0, next: 0, expected: [], matched: false },
    { shown: 0, next: 1, expected: [], matched: false },
    { shown: 1, next: 0, expected: [ROUTE_DIALOG_CLOSE_TYPE], matched: true },
    { shown: 1, next: 1, expected: [], matched: true },
    { shown: 2, next: 0, expected: [], matched: false },
    { shown: 0, next: 2, expected: [], matched: false },
  ])(
    "今の画面に $shown 個、行き先に $next 個のダイアログがあると $expected (行き先の照合: $matched)",
    ({ shown, next, expected, matched }) => {
      const matchNext = vi.fn(() => matches(next));

      expect(routeDialogViewTransitionTypes(matches(shown), matchNext)).toEqual(expected);
      expect(matchNext).toHaveBeenCalledTimes(matched ? 1 : 0);
    },
  );
});

const location = parsedLocation("/board");

function staticRouter(shown: number, next: number): RouteDialogMatchSource {
  return { state: { matches: matches(shown) }, matchRoutes: () => matches(next) };
}

describe("createDefaultViewTransition", () => {
  it.each([
    { shown: 1, next: 0 },
    { shown: 0, next: 1 },
  ])(
    "UA の遷移の直後は、今の画面に $shown 個、行き先に $next 個のダイアログがあっても View Transition ごと飛ばし、次の遷移では飛ばさない",
    ({ shown, next }) => {
      const target = new EventTarget();
      const { types } = createDefaultViewTransition(target, () => staticRouter(shown, next));
      target.dispatchEvent(createPopstateEvent({ hasUAVisualTransition: true }));

      expect(types({ toLocation: location })).toBe(false);
      expect(types({ toLocation: location })).not.toBe(false);
    },
  );

  it("行き先の照合に失敗したら、警告を残してダイアログの type を付けない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("照合に失敗");
    const { types } = createDefaultViewTransition(new EventTarget(), () => ({
      state: { matches: matches(1) },
      matchRoutes: () => {
        throw error;
      },
    }));

    expect(types({ toLocation: location })).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { href: "/board", error });
  });

  async function typesFrom(from: string, to: string) {
    const router = createTreeRouter(from);
    await router.load();
    const { types } = createDefaultViewTransition(new EventTarget(), () => router);
    return types({ toLocation: parsedLocation(to) });
  }

  it.each([
    { from: "/board/new", to: "/board", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/groups/g1/items/new", to: "/groups/g1/items", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/board/new", to: "/groups/g1/items", expected: [ROUTE_DIALOG_CLOSE_TYPE] },
    { from: "/board", to: "/board/new", expected: [] },
    { from: "/board/new", to: "/board/c1/edit", expected: [] },
    { from: "/board", to: "/groups/g1/items", expected: [] },
  ])("router の match で、$from から $to へ移ると $expected", async ({ from, to, expected }) => {
    expect(await typesFrom(from, to)).toEqual(expected);
  });
});
