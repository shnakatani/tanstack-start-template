import { describe, expect, it, vi } from "vite-plus/test";

import { dispatchNativeClick } from "@/test/native-click";

describe("dispatchNativeClick", () => {
  it("bubbles=true / cancelable=true の click イベントを 1 回だけ発火する", () => {
    const element = document.createElement("button");
    const listener = vi.fn<(event: MouseEvent) => void>();
    element.addEventListener("click", listener);

    dispatchNativeClick(element);

    expect(listener).toHaveBeenCalledOnce();
    const [event] = listener.mock.lastCall ?? [];
    expect(event?.bubbles).toBe(true);
    expect(event?.cancelable).toBe(true);
  });

  it("ハンドラの preventDefault で submit ボタンの form 送信を止められる", () => {
    const form = document.createElement("form");
    const button = document.createElement("button");
    button.type = "submit";
    form.append(button);
    document.body.append(form);
    const onSubmit = vi.fn<(event: SubmitEvent) => void>((event) => event.preventDefault());
    form.addEventListener("submit", onSubmit);
    button.addEventListener("click", (event) => {
      event.preventDefault();
    });

    dispatchNativeClick(button);

    expect(onSubmit).not.toHaveBeenCalled();
    form.remove();
  });
});
