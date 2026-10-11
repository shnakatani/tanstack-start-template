import { describe, expect, it } from "vite-plus/test";

import { focusAfterRouteDialogClosed } from "./route-dialog-focus";

describe("focusAfterRouteDialogClosed", () => {
  const link = { name: "開いた元のリンク" };

  // 閉じた時点でもダイアログの route は表示されたままなので、dialogShown は true で渡す
  const closed = { closedBy: "閉じた", closedBeforeUnmount: true, dialogShown: true };
  const left = { closedBy: "戻る・進むで離れた", closedBeforeUnmount: false, dialogShown: false };
  const replaced = {
    closedBy: "別のダイアログに替わった",
    closedBeforeUnmount: false,
    dialogShown: true,
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
    ({ closedBeforeUnmount, dialogShown, returnTarget, expected }) => {
      expect(focusAfterRouteDialogClosed({ closedBeforeUnmount, dialogShown, returnTarget })).toBe(
        expected,
      );
    },
  );
});
