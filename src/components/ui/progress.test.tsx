import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Progress, ProgressTrack } from "@/components/ui/progress";

describe("Progress", () => {
  // registry は children の後に既定の Track を無条件で描画するため、Track を含む children を
  // 渡すと 2 本になる。ローカルはフォールバック化してあり 1 本に保たれる (ADR-0006 の乖離)
  it("Track を含む children を渡しても track が 1 本に保たれる", async () => {
    const screen = await render(
      <Progress value={50}>
        <ProgressTrack />
      </Progress>,
    );

    const progress = screen.getByRole("progressbar").element();
    const tracks = progress.querySelectorAll('[data-slot="progress-track"]');

    expect(tracks).toHaveLength(1);
  });
});
