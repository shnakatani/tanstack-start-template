import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "./a11y";

describe("expectNoA11yViolations", () => {
  it("axe が判定できなかった項目を warning の注釈で残す", async () => {
    // グラデーションの上の文字は背景色を 1 つに決められず、color-contrast が incomplete になる
    const screen = await render(
      <main style={{ backgroundImage: "linear-gradient(white, black)" }}>
        <p>グラデーションの上の文字</p>
      </main>,
    );
    const annotate = vi.fn();

    await expectNoA11yViolations(screen.container, annotate);

    expect(annotate).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("color-contrast"),
      "warning",
    );
  });

  it("判定できなかった項目が無ければ注釈を残さない", async () => {
    const screen = await render(
      <main>
        <p>白地の黒い文字</p>
      </main>,
    );
    const annotate = vi.fn();

    await expectNoA11yViolations(screen.container, annotate);

    expect(annotate).not.toHaveBeenCalled();
  });
});
