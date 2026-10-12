import { createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { PendingContent } from "@/components/screens/pending";
import { ROUTE_DIALOG_CLOSE_TYPE } from "@/lib/route-dialog-view-transition";
import { createPopstateEvent } from "@/test/app/popstate-event";

import { getRouter } from "./router";

// pending 表示を持たない route には Suspense 境界が張られず、suspend は root の Outlet まで
// 巻き上がる。既定が無いとそこで何も描かれない (ADR-0029)
it("route が pending 表示を持たないときの受け皿として PendingContent を既定にする", () => {
  expect(getRouter().options.defaultPendingComponent).toBe(PendingContent);
});

// root route の error boundary の外で router を購読する部品 (遷移の読み上げなど) と Provider を置く 1 か所を渡す
it("InnerWrap に RouterInnerWrap を渡す", () => {
  expect(getRouter().options.InnerWrap).toBe(RouterInnerWrap);
});

describe("defaultViewTransition", () => {
  // Node には window が無いので、types の関数を組む側へ通すために popstate を出す相手を置く。
  // document は無いままなので router はサーバーとして動き、history を持たない。TanStack Start の
  // createStartHandler と同じく、history は update で渡す
  function clientRouter() {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const router = getRouter();
    router.update({ ...router.options, history: createMemoryHistory({ initialEntries: ["/"] }) });
    const { defaultViewTransition } = router.options;
    expect.assert(typeof defaultViewTransition === "object");
    const { types } = defaultViewTransition;
    expect.assert(typeof types === "function");
    const toLocation = router.state.location;
    const evaluate = () =>
      types({ toLocation, pathChanged: true, hrefChanged: true, hashChanged: false });
    return { target, router, toLocation, evaluate };
  }

  it("ブラウザが遷移のアニメーションを出した戻る・進むでは View Transition を飛ばす", () => {
    const { target, evaluate } = clientRouter();
    target.dispatchEvent(createPopstateEvent({ hasUAVisualTransition: true }));

    expect(evaluate()).toBe(false);
  });

  it("この router の今の画面にあるダイアログが行き先で無くなる遷移に、閉じる遷移の type を付ける", () => {
    const { router, toLocation, evaluate } = clientRouter();
    // 行き先の最後の match に印を付けて今の画面にする。行き先の照合は印の無い本物の match を返す
    const next = router.matchRoutes(toLocation.pathname, toLocation.search);
    const last = next.at(-1);
    expect.assert(last);
    const shown = [...next.slice(0, -1), { ...last, staticData: { routeDialog: true as const } }];
    vi.spyOn(router, "state", "get").mockReturnValue({ ...router.state, matches: shown });

    expect(evaluate()).toEqual([ROUTE_DIALOG_CLOSE_TYPE]);
  });
});
