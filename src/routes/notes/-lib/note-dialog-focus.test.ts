import { describe, expect, it } from "vite-plus/test";

import { focusAfterRouteDialogClosed, hasNotesChildMatch } from "./note-dialog-focus";

describe("focusAfterRouteDialogClosed", () => {
  const link = { name: "開いた元のリンク" };

  // 閉じた時点でもダイアログの route は表示されたままなので、dialogRouteShown は true で渡す
  const closed = { closedBy: "閉じた", closedBeforeUnmount: true, dialogRouteShown: true };
  const left = {
    closedBy: "戻る・進むで離れた",
    closedBeforeUnmount: false,
    dialogRouteShown: false,
  };
  const replaced = {
    closedBy: "別のダイアログに替わった",
    closedBeforeUnmount: false,
    dialogRouteShown: true,
  };

  it.each([
    { ...closed, target: "ある", returnTarget: link, expected: link },
    { ...closed, target: "無い", returnTarget: null, expected: "page-heading" },
    { ...left, target: "ある", returnTarget: link, expected: link },
    { ...left, target: "無い", returnTarget: null, expected: false },
    { ...replaced, target: "ある", returnTarget: link, expected: false },
    { ...replaced, target: "無い", returnTarget: null, expected: false },
  ])(
    "$closedBy とき、戻し先が$target なら $expected を返す",
    ({ closedBeforeUnmount, dialogRouteShown, returnTarget, expected }) => {
      expect(
        focusAfterRouteDialogClosed({ closedBeforeUnmount, dialogRouteShown, returnTarget }),
      ).toBe(expected);
    },
  );
});

describe("hasNotesChildMatch", () => {
  it("一覧の route の後ろに子の match があれば true", () => {
    expect(
      hasNotesChildMatch([
        { routeId: "__root__" },
        { routeId: "/notes" },
        { routeId: "/notes/new" },
      ]),
    ).toBe(true);
  });

  it("一覧の route の match が末尾にあり、子の match が無ければ false", () => {
    expect(hasNotesChildMatch([{ routeId: "__root__" }, { routeId: "/notes" }])).toBe(false);
  });

  it("一覧の route の match が無ければ (別のページ)、ほかの match があっても false", () => {
    expect(hasNotesChildMatch([{ routeId: "__root__" }, { routeId: "/" }])).toBe(false);
  });
});
