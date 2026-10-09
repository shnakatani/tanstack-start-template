import { describe, expect, it } from "vite-plus/test";

import { skipViewTransitionAfterUATransition } from "./skip-view-transition-after-ua-transition";

function navigateEvent(hasUAVisualTransition: boolean): Event {
  return Object.assign(new Event("navigate"), { hasUAVisualTransition });
}

describe("skipViewTransitionAfterUATransition", () => {
  it("navigate がまだ無ければ View Transition を飛ばさない", () => {
    const types = skipViewTransitionAfterUATransition(new EventTarget());
    expect(types()).toEqual([]);
  });

  it("ブラウザが遷移のアニメーションを出したナビゲーションでは飛ばす", () => {
    const navigation = new EventTarget();
    const types = skipViewTransitionAfterUATransition(navigation);
    navigation.dispatchEvent(navigateEvent(true));
    expect(types()).toBe(false);
  });

  it("次のナビゲーションでブラウザが出さなければ、また View Transition を使う", () => {
    const navigation = new EventTarget();
    const types = skipViewTransitionAfterUATransition(navigation);
    navigation.dispatchEvent(navigateEvent(true));
    navigation.dispatchEvent(navigateEvent(false));
    expect(types()).toEqual([]);
  });
});
