import { describe, expect, it } from "vite-plus/test";

import { focusAfterRouteDialogClosed } from "./route-dialog-focus";

describe("focusAfterRouteDialogClosed", () => {
  const link = { name: "開いた元のリンク" };

  // 閉じたときは atReturnTo を見ない。hook と同じく false で渡し、atReturnTo より先に閉じたかを見ることを確かめる
  const closed = { closedBy: "閉じた", closedBeforeUnmount: true, atReturnTo: false };
  const left = { closedBy: "戻る・進むで離れた", closedBeforeUnmount: false, atReturnTo: true };
  const replaced = {
    closedBy: "別のダイアログに替わった",
    closedBeforeUnmount: false,
    atReturnTo: false,
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
    ({ closedBeforeUnmount, atReturnTo, returnTarget, expected }) => {
      expect(focusAfterRouteDialogClosed({ closedBeforeUnmount, atReturnTo, returnTarget })).toBe(
        expected,
      );
    },
  );
});
