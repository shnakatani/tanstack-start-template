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
      // 無くなる。そのときこの 2 行は評価されず、テスト自身が timeout して赤になる
      // (2026-09-22 に実測。15105ms で `Test timed out`)。下の 2 つが効くのは、予算が
      // 有限だが大きすぎる形へ退行したときである (ADR-0029)。
      //
      // このテストは健全でも予算をまるごと使う。browser project に固定で 5 秒が乗るのは
      // 承知のうえで、ハングと見分けるためにこのコメントを残す
      const startedAt = performance.now();
      await expect(findElement(screen.getByText("ない"))).rejects.toThrow(
        /Cannot find element with locator/,
      );
      expect(performance.now() - startedAt).toBeLessThan(ASSERT_TIMEOUT_MS * 1.5);
    },
    ASSERT_TIMEOUT_MS * 3,
  );
});
