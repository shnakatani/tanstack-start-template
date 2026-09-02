import { describe, expect, it, vi } from "vite-plus/test";

import { dispatchNativeClick } from "@/test/native-click";

describe("dispatchNativeClick", () => {
  it("bubbles=true の click イベントを 1 回だけ発火する", () => {
    const element = document.createElement("button");
    const listener = vi.fn<(event: MouseEvent) => void>();
    element.addEventListener("click", listener);

    dispatchNativeClick(element);

    expect(listener).toHaveBeenCalledOnce();
    const [event] = listener.mock.lastCall ?? [];
    expect(event?.bubbles).toBe(true);
  });
});
