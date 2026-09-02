import { afterEach, describe, expect, it } from "vite-plus/test";

import { waitForAnimations } from "@/test/wait-for-animations";

const created: Element[] = [];

function appendAnimatedBox(keyframes: Keyframe[], options: KeyframeAnimationOptions): Element {
  const host = document.createElement("div");
  const child = document.createElement("div");
  host.append(child);
  document.body.append(host);
  created.push(host);
  child.animate(keyframes, options);
  return host;
}

afterEach(() => {
  for (const element of created.splice(0)) element.remove();
});

describe("waitForAnimations", () => {
  it("子孫の有限アニメーションが完了するまで待つ", async () => {
    const host = appendAnimatedBox([{ opacity: 0 }, { opacity: 1 }], { duration: 50 });

    await waitForAnimations(host);

    expect(host.getAnimations({ subtree: true })).toHaveLength(0);
  });

  it("無限アニメーションは待たずに解決する", async () => {
    const host = appendAnimatedBox([{ opacity: 0 }, { opacity: 1 }], {
      duration: 50,
      iterations: Number.POSITIVE_INFINITY,
    });

    await waitForAnimations(host);

    // 無限アニメーションは除外されるため、待機後もまだ実行中のまま
    expect(host.getAnimations({ subtree: true })).toHaveLength(1);
  });

  it("待機中にキャンセルされたアニメーションでも reject しない", async () => {
    const host = appendAnimatedBox([{ opacity: 0 }, { opacity: 1 }], { duration: 10_000 });
    const [animation] = host.getAnimations({ subtree: true });

    const settled = waitForAnimations(host);
    animation?.cancel();

    await expect(settled).resolves.toBeUndefined();
  });

  it("アニメーションが 1 つも無ければ即座に解決する", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    created.push(host);

    await expect(waitForAnimations(host)).resolves.toBeUndefined();
  });
});
