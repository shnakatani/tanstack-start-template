import type { AnyRouteMatch } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  failureScreenLayout,
  pageHeadingNameOf,
  type FailureScreenLayout,
  type RouteFailureKind,
} from "./page-name";

type Match = Pick<AnyRouteMatch, "routeId" | "status" | "staticData">;

const root: Match = { routeId: "__root__", status: "success", staticData: {} };
const items: Match = { routeId: "/items", status: "success", staticData: { pageName: "項目一覧" } };
const itemCreate: Match = {
  routeId: "/items/new",
  status: "success",
  staticData: { pageName: "項目を追加", routeDialog: true },
};

describe("pageHeadingNameOf", () => {
  it("staticData.pageName を返す", () => {
    expect(pageHeadingNameOf({ pageName: "項目一覧" })).toBe("項目一覧");
  });

  // ダイアログの名前は title にだけ使い、背後のページの見出しの行を変えない
  it("ダイアログの route なら名前を返さない", () => {
    expect(pageHeadingNameOf({ pageName: "項目を追加", routeDialog: true })).toBeUndefined();
  });

  it("名前が無ければ返さない", () => {
    expect(pageHeadingNameOf({})).toBeUndefined();
  });
});

interface LayoutCase {
  scene: string;
  matches: Match[];
  own: string;
  kind: RouteFailureKind;
  expected: FailureScreenLayout;
}

describe("failureScreenLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // spec の「見出しの行」の場面の表の各行。置き換え = 自分の route の component を置き換えて出た画面、
  // Outlet の中 = 自分の route の component が描かれたまま、その <Outlet /> の位置に出た画面
  it.each<LayoutCase>([
    {
      scene: "ページの loader の失敗を、そのページの境界が受ける",
      matches: [root, { ...items, status: "error" }],
      own: "/items",
      kind: "error",
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの loader の失敗を、root の errorComponent が受ける",
      matches: [root, { ...items, status: "error" }],
      own: "__root__",
      kind: "error",
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの描画中の throw (どの match も success)",
      matches: [root, items],
      own: "/items",
      kind: "error",
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ダイアログを開いたまま、背後のページの描画中に throw する",
      matches: [root, items, itemCreate],
      own: "/items",
      kind: "error",
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの notFoundComponent が、自分の loader の notFound() を受ける",
      matches: [root, { ...items, status: "notFound" }],
      own: "/items",
      kind: "notFound",
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの <Outlet /> の中の not found (ページの見出しの行が上に残る)",
      matches: [root, items],
      own: "/items",
      kind: "notFound",
      expected: { headingRowName: undefined, failureHeadingLevel: 2 },
    },
    {
      scene: "名前の付いたページの無い URL",
      matches: [root],
      own: "__root__",
      kind: "notFound",
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      // 境界 (root) より深い match の状態と名前は読まない
      scene: "root の beforeLoad の失敗",
      matches: [
        { ...root, status: "error" },
        { ...items, status: "pending" },
      ],
      own: "__root__",
      kind: "error",
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      // root の <Outlet /> の中に出るので、自分 (root) より深い match の名前は読まない
      scene: "root を境界にする notFound()",
      matches: [root, { ...items, status: "notFound" }],
      own: "__root__",
      kind: "notFound",
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      scene: "ダイアログの route が既定の errorComponent で落ちる (ページの見出しの行が上に残る)",
      matches: [root, items, { ...itemCreate, status: "error" }],
      own: "/items/new",
      kind: "error",
      expected: { headingRowName: undefined, failureHeadingLevel: 2 },
    },
  ])("$scene", ({ matches, own, kind, expected }) => {
    expect(failureScreenLayout(matches, own, kind)).toEqual(expected);
  });

  it("自分の routeId が matches に無ければ、名前の無い全画面の形にし、警告を残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(failureScreenLayout([root, items], "/other", "error")).toEqual({
      headingRowName: undefined,
      failureHeadingLevel: 1,
    });
    expect(warn).toHaveBeenCalledWith("[failureScreenLayout] 自分の routeId が matches に無い", {
      ownRouteId: "/other",
      routeIds: ["__root__", "/items"],
    });
  });
});
