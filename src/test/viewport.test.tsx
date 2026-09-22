import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { expectWithinViewport } from "@/test/viewport";

afterEach(() => {
  vi.resetConfig();
});

/**
 * 落ちる向きを見るテストは assert の予算 (ADR-0030) を待たない。`vi.setConfig` の docs の例に
 * `expect` は無いが、受け取る `RuntimeConfig` 型 (vitest 4.1.11 `config.d.ts`) が `expect` を持ち、
 * `expect.poll` は呼び出しごとに config を読む。timeout 0 でも 1 回は評価され、失敗文は同じ。
 * 他ファイルへは漏れない。`isolate` (既定 true。`browser.isolate` は vitest 4.1 で deprecated) でファイルごとに iframe が分かれ、config は
 * その iframe の module state にある。`isolate: false` にすると漏れるので `afterEach` の reset も残す
 */
function doNotWaitForTheBudget() {
  vi.setConfig({ expect: { poll: { timeout: 0 } } });
}

/** 辺ごとの判定は `viewport-overflows.test.ts` が持つ。ここは locator から矩形を読む配線だけを見る */
describe("expectWithinViewport", () => {
  it("viewport 内に収まる要素は通過する", async () => {
    const screen = await render(
      <div
        data-testid="box"
        style={{ position: "fixed", top: 10, left: 10, width: 50, height: 50 }}
      />,
    );

    await expectWithinViewport(screen.getByTestId("box"));
  });

  it("はみ出した辺が失敗文に出る", async () => {
    doNotWaitForTheBudget();
    const screen = await render(
      <div
        data-testid="box"
        style={{ position: "fixed", top: window.innerHeight - 10, left: 10, width: 50, height: 50 }}
      />,
    );

    await expect(expectWithinViewport(screen.getByTestId("box"))).rejects.toThrow("bottom +40px");
  });

  it("要素が無ければ locator 名で落ちる", async () => {
    doNotWaitForTheBudget();

    await expect(expectWithinViewport(page.getByTestId("missing"))).rejects.toThrow(/missing/);
  });
});
