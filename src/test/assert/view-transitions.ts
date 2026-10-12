import { expect, onTestFinished, vi } from "vite-plus/test";

/**
 * これから `document.startViewTransition` の呼び出しを記録し、操作が始めた View Transition を読む関数を返す。
 * router は返った ViewTransition の `updateCallbackDone` を待つので、元の実装をそのまま呼ぶ
 */
export function recordViewTransitions() {
  const spy = vi.spyOn(document, "startViewTransition");
  onTestFinished(() => {
    spy.mockRestore();
  });
  /** `action` が始めた View Transition の types と ViewTransition を返す */
  return vi.defineHelper(async (action: () => Promise<void> | void) => {
    const before = spy.mock.calls.length;
    await action();
    await expect.poll(() => spy.mock.calls.length).toBeGreaterThan(before);
    const [options] = spy.mock.calls[before] ?? [];
    const result = spy.mock.results[before];
    expect.assert(result?.type === "return");
    return {
      types: typeof options === "object" ? options.types : undefined,
      transition: result.value,
    };
  });
}
