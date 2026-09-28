import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "./a11y";

describe("expectNoA11yViolations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("axe が判定できなかった項目を、warning の注釈と console.warn の両方で残す", async () => {
    // グラデーションの上の文字は背景色を 1 つに決められず、color-contrast が incomplete になる
    const screen = await render(
      <main style={{ backgroundImage: "linear-gradient(white, black)" }}>
        <p>グラデーションの上の文字</p>
      </main>,
    );
    const annotate = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expectNoA11yViolations(screen.container, annotate);

    // 注釈は GitHub Actions の画面に出るが、端末の default reporter は通ったテストの注釈を出さない。
    // console.warn は端末に出る
    expect(annotate).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("color-contrast"),
      "warning",
    );
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[a11y] axe が判定できなかった項目",
      expect.arrayContaining([expect.stringContaining("color-contrast")]),
    );
  });

  it("判定できなかった項目が無ければ注釈を残さない", async () => {
    const screen = await render(
      <main>
        <p>白地の黒い文字</p>
      </main>,
    );
    const annotate = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expectNoA11yViolations(screen.container, annotate);

    expect(annotate).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
