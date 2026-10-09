import { describe, expect, it } from "vite-plus/test";

import { skipViewTransitionAfterUATransition } from "./skip-view-transition-after-ua-transition";

function popstate(hasUAVisualTransition: boolean): Event {
  return Object.assign(new Event("popstate"), { hasUAVisualTransition });
}

describe("skipViewTransitionAfterUATransition", () => {
  it("戻る・進むがまだ無ければ View Transition を飛ばさない", () => {
    const types = skipViewTransitionAfterUATransition(new EventTarget());
    expect(types()).toEqual([]);
  });

  it("ブラウザが遷移のアニメーションを出した戻る・進むでは飛ばす", () => {
    const target = new EventTarget();
    const types = skipViewTransitionAfterUATransition(target);
    target.dispatchEvent(popstate(true));
    expect(types()).toBe(false);
  });

  it("飛ばしたあとの遷移 (popstate の出ない push を含む) では、また View Transition を使う", () => {
    const target = new EventTarget();
    const types = skipViewTransitionAfterUATransition(target);
    target.dispatchEvent(popstate(true));
    types();
    expect(types()).toEqual([]);
  });

  it("ブラウザがアニメーションを出した戻る・進むの後に、出さなかった戻る・進むが続けば飛ばさない", () => {
    const target = new EventTarget();
    const types = skipViewTransitionAfterUATransition(target);
    target.dispatchEvent(popstate(true));
    target.dispatchEvent(popstate(false));
    expect(types()).toEqual([]);
  });
});
