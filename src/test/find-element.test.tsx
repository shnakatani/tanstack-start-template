import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { ASSERT_TIMEOUT_MS } from "./assert-budget";
import { findElement } from "./find-element";

describe("findElement", () => {
  it("在る要素の生 DOM を返す", async () => {
    const screen = await render(<div>ある</div>);

    const element = await findElement(screen.getByText("ある"));

    expect(element.textContent).toBe("ある");
  });

  it(
    "現れない要素では locator を名指して落ちる。予算を使い切ったら止まる",
    async () => {
      const screen = await render(<div>ある</div>);

      // `{ timeout }` を渡し忘れると、`actionTimeout` を置いた config では待ちに上限が
      // 無くなり、テスト全体が `Test timed out` で落ちて locator 名が消える (ADR-0029)。
      // 所要の上限と文言の両方でその退行を捕まえる
      const startedAt = performance.now();
      await expect(findElement(screen.getByText("ない"))).rejects.toThrow(
        /Cannot find element with locator/,
      );
      expect(performance.now() - startedAt).toBeLessThan(ASSERT_TIMEOUT_MS * 1.5);
    },
    ASSERT_TIMEOUT_MS * 3,
  );
});
