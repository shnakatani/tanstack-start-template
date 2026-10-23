import type { AnyRouteMatch } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  failureScreenLayout,
  pageHeadingNameOf,
  type FailureScreenLayout,
  type RouteFailureKind,
} from "./page-name";

type Match = Pick<AnyRouteMatch, "id" | "status" | "staticData">;

// match の id は router と同じく、route の id と path をつないだ形にする
const root: Match = { id: "__root__/", status: "success", staticData: {} };
const items: Match = {
  id: "/items/items",
  status: "success",
  staticData: { pageName: "項目一覧" },
};
const itemCreate: Match = {
  id: "/items/new/items/new",
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
  underPageHeading: boolean;
  expected: FailureScreenLayout;
}

describe("failureScreenLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // underPageHeading = 失敗の画面がページの PageOutlet の中に描かれ、ページの見出しの行 (h1) が上に残る
  it.each<LayoutCase>([
    {
      scene: "ページの loader の失敗を、そのページの境界が受ける",
      matches: [root, { ...items, status: "error" }],
      own: items.id,
      kind: "error",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの loader の失敗を、root の errorComponent が受ける",
      matches: [root, { ...items, status: "error" }],
      own: root.id,
      kind: "error",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの描画中の throw (どの match も success)",
      matches: [root, items],
      own: items.id,
      kind: "error",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ダイアログを開いたまま、背後のページの描画中に throw する",
      matches: [root, items, itemCreate],
      own: items.id,
      kind: "error",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの notFoundComponent が、自分の loader の notFound() を受ける",
      matches: [root, { ...items, status: "notFound" }],
      own: items.id,
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      // match の status は success のままで、Outlet の中の not found と同じ matches になる
      scene: "ページの notFoundComponent が、自分の描画中の notFound() を受ける",
      matches: [root, items],
      own: items.id,
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: "項目一覧", failureHeadingLevel: 2 },
    },
    {
      scene: "ページの PageOutlet の中の not found",
      matches: [root, items],
      own: items.id,
      kind: "notFound",
      underPageHeading: true,
      expected: { headingRowName: undefined, failureHeadingLevel: 2 },
    },
    {
      scene: "ダイアログの route が既定の errorComponent で、ページの PageOutlet の中に落ちる",
      matches: [root, items, { ...itemCreate, status: "error" }],
      own: itemCreate.id,
      kind: "error",
      underPageHeading: true,
      expected: { headingRowName: undefined, failureHeadingLevel: 2 },
    },
    {
      scene: "名前の付いたページの無い URL",
      matches: [root],
      own: root.id,
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      scene: "名前の無いレイアウトの <Outlet /> の中の not found",
      matches: [root, { id: "/groups/groups", status: "success", staticData: {} }],
      own: "/groups/groups",
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      // レイアウトは h1 を描かないので、失敗の画面がレイアウトの名前の行を描く
      scene: "名前の付いたレイアウトの <Outlet /> の中の not found",
      matches: [
        root,
        { id: "/groups/groups", status: "success", staticData: { pageName: "グループ" } },
      ],
      own: "/groups/groups",
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: "グループ", failureHeadingLevel: 2 },
    },
    {
      // 境界 (root) より深い match の状態と名前は読まない
      scene: "root の beforeLoad の失敗",
      matches: [
        { ...root, status: "error" },
        { ...items, status: "pending" },
      ],
      own: root.id,
      kind: "error",
      underPageHeading: false,
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
    {
      // root の <Outlet /> の中に出るので、自分 (root) より深い match の名前は読まない
      scene: "root を境界にする notFound()",
      matches: [root, { ...items, status: "notFound" }],
      own: root.id,
      kind: "notFound",
      underPageHeading: false,
      expected: { headingRowName: undefined, failureHeadingLevel: 1 },
    },
  ])("$scene", ({ matches, own, kind, underPageHeading, expected }) => {
    expect(failureScreenLayout(matches, own, kind, underPageHeading)).toEqual(expected);
  });

  it("自分の match の id が matches に無ければ、名前の無い全画面の形にし、警告を残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(failureScreenLayout([root, items], "/other/other", "error", false)).toEqual({
      headingRowName: undefined,
      failureHeadingLevel: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      "[failureScreenLayout] 自分の match の id が matches に無い",
      {
        ownMatchId: "/other/other",
        matchIds: ["__root__/", "/items/items"],
      },
    );
  });
});
