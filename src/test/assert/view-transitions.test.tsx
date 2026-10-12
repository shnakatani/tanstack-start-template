import { describe, expect, it } from "vite-plus/test";

import { recordViewTransitions } from "./view-transitions";

describe("recordViewTransitions", () => {
  it("操作が始めた View Transition の types と、その ViewTransition を返す", async () => {
    const transitionOf = recordViewTransitions();
    // 記録を始めたあと、操作の前に始まった遷移は読まない
    await document.startViewTransition({ update: () => {}, types: ["before"] }).finished;
    let started: ViewTransition | undefined;

    const { types, transition } = await transitionOf(() => {
      started = document.startViewTransition({ update: () => {}, types: ["slide"] });
    });

    expect(types).toEqual(["slide"]);
    expect(transition).toBe(started);
    await transition.finished;
  });

  it("types を渡さずに始めた View Transition では、types を返さない", async () => {
    const transitionOf = recordViewTransitions();

    const { types, transition } = await transitionOf(() => {
      document.startViewTransition(() => {});
    });

    expect(types).toBeUndefined();
    await transition.finished;
  });
});
