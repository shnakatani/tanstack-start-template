import type { AnyRouteMatch, ParsedLocation } from "@tanstack/react-router";

import { skipViewTransitionAfterUATransition } from "./skip-view-transition-after-ua-transition";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * route として開くダイアログの印 (ADR-0041「閉じる遷移の見せ方」)。ダイアログでない route には書かない。
     * View Transition の type の判定と、`useRouteDialog` の付け忘れの警告が読む
     */
    routeDialog?: true;
  }
}

/** View Transition の type。`src/styles.css` の `:active-view-transition-type()` と同じ字面にする */
export const ROUTE_DIALOG_CLOSE_TYPE = "route-dialog-close";

type StaticDataCarrier = Pick<AnyRouteMatch, "staticData">;

/** router のうち、types の関数が読む部分 */
export interface RouteDialogMatchSource {
  readonly state: { readonly matches: ReadonlyArray<StaticDataCarrier> };
  matchRoutes: (
    pathname: string,
    search: ParsedLocation["search"],
  ) => ReadonlyArray<StaticDataCarrier>;
}

type ViewTransitionTypes = (info: { toLocation: ParsedLocation }) => string[] | false;

function countRouteDialogs(matches: ReadonlyArray<StaticDataCarrier>): number {
  return matches.filter((match) => match.staticData.routeDialog === true).length;
}

/**
 * 今の画面の match (`shown`) と行き先の match (`matchNext`) から、ダイアログの route の View Transition の type を返す。
 * 名前 `route-dialog` は 1 つの capture に 1 つしか置けないので、type を返すのはダイアログが今の画面にちょうど
 * 1 つあり、行き先に無いときだけにする。別のダイアログに替わるとき (1 と 1) は名前を付けず、今のクロスフェードの
 * ままにする。
 * 行き先の match を組むと route ごとに `validateSearch` と `loaderDeps` が走るので、今の画面のダイアログが 1 つで
 * なければ `matchNext` を呼ばない
 */
export function routeDialogViewTransitionTypes(
  shown: ReadonlyArray<StaticDataCarrier>,
  matchNext: () => ReadonlyArray<StaticDataCarrier>,
): string[] {
  if (countRouteDialogs(shown) !== 1) {
    return [];
  }
  return countRouteDialogs(matchNext()) === 0 ? [ROUTE_DIALOG_CLOSE_TYPE] : [];
}

/**
 * router の `defaultViewTransition` に渡す値を返す。ブラウザが自分で遷移のアニメーションを出した戻る・進むでは
 * View Transition を飛ばし (ADR-0040)、ダイアログの route を閉じる遷移には type を足す (ADR-0041)。
 * `target` は router が戻る・進むで聞く `popstate` を出すもの (ブラウザでは `window`)。
 * UA の遷移の判定は毎回先に呼ぶ。判定は記録した値を読んだら戻すので、呼ばないと値が次の遷移まで残る。
 * 今の画面は types の評価時点の `router.state.matches` で読む。読み込み中のダイアログ (`pendingComponent`) の
 * match も含む。`fromLocation` は読み込み中のダイアログから閉じると開く元のページのままなので使わない
 */
export function createDefaultViewTransition(
  target: EventTarget,
  getRouter: () => RouteDialogMatchSource,
): { types: ViewTransitionTypes } {
  const skipAfterUATransition = skipViewTransitionAfterUATransition(target);
  return {
    types: (info) => {
      const baseTypes = skipAfterUATransition();
      if (baseTypes === false) {
        return false;
      }
      try {
        const router = getRouter();
        const dialogTypes = routeDialogViewTransitionTypes(router.state.matches, () =>
          router.matchRoutes(info.toLocation.pathname, info.toLocation.search),
        );
        return [...baseTypes, ...dialogTypes];
      } catch (error) {
        // 判定に失敗しても遷移は止めず、ダイアログの退場の無いクロスフェードにする
        console.warn("[route-dialog-view-transition] type を判定できなかった", {
          href: info.toLocation.href,
          error,
        });
        return baseTypes;
      }
    },
  };
}
