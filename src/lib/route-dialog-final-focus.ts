import { moveFocusToPageHeading } from "./focus-page-heading";
import { focusAfterRouteDialogClosed } from "./route-dialog-focus";

/**
 * ダイアログの route の Dialog が Base UI の `finalFocus` から呼ぶ関数。`closedBeforeUnmount` は unmount の前に
 * 閉じ始めていたか (閉じる操作、保存の応答)。開いたまま unmount したときは false
 */
export type RouteDialogFinalFocus = (closedBeforeUnmount: boolean) => HTMLElement | false;

/**
 * ダイアログの route を閉じたときの focus の移し先を返す関数を作る (ADR-0041「閉じたときの focus」)。
 * route の構造は読まず、ダイアログを持つページから 2 つの関数を受け取り、返した関数が呼ばれた時点で呼ぶ。
 *
 * - isDialogShown: ダイアログを持つページの `<Outlet />` に、ダイアログの route が表示されているか。呼ばれた時点の
 *   router の状態 (`router.state.matches`) を読む。描画の時点に読んだ値は、unmount の時点の遷移先を映さない
 * - findReturnTarget: 開いた元の要素を探す。URL を直接開いたときは Base UI の既定の戻し先 (開く前に focus して
 *   いた要素) が無いので、要素を探して返す
 */
export function createRouteDialogFinalFocus({
  isDialogShown,
  findReturnTarget,
}: {
  isDialogShown: () => boolean;
  findReturnTarget: () => HTMLElement | null;
}): RouteDialogFinalFocus {
  return (closedBeforeUnmount) => {
    const target = focusAfterRouteDialogClosed({
      closedBeforeUnmount,
      dialogShown: isDialogShown(),
      returnTarget: findReturnTarget(),
    });
    if (target === "page-heading") {
      moveFocusToPageHeading();
      return false;
    }
    return target;
  };
}
