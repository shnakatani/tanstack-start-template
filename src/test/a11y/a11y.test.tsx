import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "./a11y";

describe("expectNoA11yViolations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("axe が判定できなかった項目を warning の注釈で残し、console.warn には出さない", async () => {
    // グラデーションの上の文字は背景色を 1 つに決められず、color-contrast が incomplete になる
    const screen = await render(
      <main style={{ backgroundImage: "linear-gradient(white, black)" }}>
        <p>グラデーションの上の文字</p>
      </main>,
    );
    const annotate = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expectNoA11yViolations(screen.container, annotate);

    expect(annotate).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("color-contrast"),
      "warning",
    );
    // 通ったテストの注釈は vitest.annotation-reporter.ts が端末に出す。console.warn にも出すと二重になる
    expect(warn).not.toHaveBeenCalled();
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
