import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Progress } from "@/components/ui/progress";

describe("Progress", () => {
  it("vega既定の6px trackを1本だけ描画する", async () => {
    const screen = await render(<Progress value={50} />);

    const progress = screen.getByRole("progressbar").element();
    const tracks = progress.querySelectorAll('[data-slot="progress-track"]');

    expect(tracks).toHaveLength(1);
    const track = tracks.item(0);
    expect(getComputedStyle(track).height).toBe("6px");
  });
});
