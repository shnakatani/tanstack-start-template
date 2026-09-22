import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectAbsent } from "./absent";
import { ASSERT_TIMEOUT_MS } from "./assert-budget";

/**
 * 表示の時点をテストが操作で決める。実時間のタイマーで出すと、負荷の高い実行では
 * `expectAbsent` を呼ぶ前に出てしまい、テスト自身が競走になる
 */
function Toggleable() {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setShown(true)}>
        出す
      </button>
      {shown ? <span>あとから出る</span> : null}
    </div>
  );
}

describe("expectAbsent", () => {
  it("要素が無ければ通る", async () => {
    const screen = await render(<div>ある</div>);

    await expectAbsent(screen.getByText("ない"));
  });

  it(
    "要素が在れば落ちる。所要は assert の予算に依らない",
    async () => {
      const screen = await render(<div>ある</div>);

      // `{ timeout: 0 }` を外すと assert の予算 (`expect.poll.timeout`) を丸ごと使う。
      // その退行をこの閾値が捕まえる (ADR-0029)。テスト側の timeout は予算より大きく取る。
      // 同値だと、退行が閾値の失敗ではなく「テストが timeout した」として出る
      const startedAt = performance.now();
      await expect(expectAbsent(screen.getByText("ある"))).rejects.toThrow(/toBeInTheDocument/);
      // 退行は予算をまるごと使うので、半分を下回れば区別できる。固定値にすると予算を
      // 下げたとき退行が閾値を下回って緑になり、比を小さくすると描画の遅い環境で赤になる
      expect(performance.now() - startedAt).toBeLessThan(ASSERT_TIMEOUT_MS / 2);
    },
    ASSERT_TIMEOUT_MS * 2,
  );

  it("後から現れる要素でも、呼んだ時点で無ければ通る", async () => {
    const screen = await render(<Toggleable />);
    const target = screen.getByText("あとから出る");

    await expectAbsent(target);

    // 待たないことの裏返し。出したあとは同じ locator が解決する
    await screen.getByRole("button", { name: "出す" }).click();
    await expect.element(target).toBeInTheDocument();
  });
});
