import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Progress, ProgressTrack } from "@/components/ui/progress";

describe("Progress", () => {
  // registry は children の後に既定の Track を無条件で描画するため、Track を含む children を
  // 渡すと 2 本になる。ローカルはフォールバック化してあり 1 本に保たれる (ADR-0026 の乖離)。
  // locator は複数一致で throw するので、`expect.element` が 1 本であることまで固定する
  // (testing.md「locator の扱い」)。0 本なら toBeInTheDocument が落ちる
  it("Track を含む children を渡しても track が 1 本に保たれる", async () => {
    const screen = await render(
      <Progress value={50}>
        <ProgressTrack />
      </Progress>,
    );

    await expect
      .element(screen.getByRole("progressbar").getBySlot("progress-track"))
      .toBeInTheDocument();
  });
});
