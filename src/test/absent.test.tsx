import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectAbsent, expectRemoved } from "./absent";
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

/**
 * 消滅を操作より後ろへずらす。`expectRemoved` は予算ぶん待って通る。遅延が負荷で延びても
 * 「後で消える」向きは変わらない。逆向き (`expectAbsent` が落ちること) はここでは見ない。
 * タイマーが assert より先に消してしまう競走になる (2026-09-22 の全 project 同時実行で反転)
 */
const REMOVAL_DELAY_MS = 150;
function DeferredRemoval() {
  const [shown, setShown] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setTimeout(() => setShown(false), REMOVAL_DELAY_MS)}>
        消す
      </button>
      {shown ? <span>あとで消える</span> : null}
    </div>
  );
}

describe("expectRemoved", () => {
  it("unmount が操作より後ろでも、予算ぶん待って通る", async () => {
    const screen = await render(<DeferredRemoval />);
    await screen.getByRole("button", { name: "消す" }).click();

    await expectRemoved(screen.getByText("あとで消える"));
  });
});

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
      // その退行をこの閾値が捕まえる (docs/guides/testing.md「否定を肯定で書く」)。テスト側の timeout は予算より大きく取る。
      // 同値だと、退行が閾値の失敗ではなく「テストが timeout した」として出る
      const startedAt = performance.now();
      await expect(expectAbsent(screen.getByText("ある"))).rejects.toThrow(/toBeInTheDocument/);
      // 健全なら 52-55ms で返る (2026-09-22、全 project 同時実行でも同じ)。この所要は予算に
      // 比例しない固定値で、退行だけが予算をまるごと使う。閾値を予算の 1/5 に置くと、退行側に
      // 5 倍の余裕が予算によらず残る。固定値にすると予算を下げたとき退行が閾値を下回って緑になる。
      // 健全側の余裕は予算に比例するので、予算を 260ms 未満へ下げるとこのテストが先に落ちる
      expect(performance.now() - startedAt).toBeLessThan(ASSERT_TIMEOUT_MS / 5);
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
