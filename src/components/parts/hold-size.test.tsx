import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { HoldSize } from "./hold-size";

/**
 * 状態のカタログは `hold-size.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * ここに残すのは、重ねるものの出入りで箱の寸法が変わらないこと (2 回の観測の比較) と、下敷きが
 * `visibility: hidden` で寸法だけを残すことで、args だけで状態が決まる部品なので story に play が無く、
 * ここでしか固定できない。
 */
describe("HoldSize", () => {
  it("重ねるものを出しても箱の寸法は下敷きのまま", async () => {
    const screen = await render(
      <div>
        <HoldSize overlay={null}>2026/08/17 09:30</HoldSize>
        <HoldSize overlay="更新中">2026/08/17 09:30</HoldSize>
      </div>,
    );
    await expect.element(screen.getByText("更新中")).toBeVisible();
    const idle = screen.getBySlot("hold-size").nth(0).element().getBoundingClientRect();
    const held = screen.getBySlot("hold-size").nth(1);

    // 重ねた「更新中」は下敷きより狭い。下敷きが流れの外へ出ると幅が縮み、重ねるものが別の行へ回ると高さが伸びる
    await expect
      .poll(() => held.element().getBoundingClientRect().width)
      .toBeCloseTo(idle.width, 0);
    await expect
      .poll(() => held.element().getBoundingClientRect().height)
      .toBeCloseTo(idle.height, 0);
  });

  it("重ねている間、下敷きは寸法だけを残して見えない", async () => {
    const screen = await render(<HoldSize overlay="更新中">2026/08/17 09:30</HoldSize>);

    await expect.element(screen.getByText("更新中")).toBeVisible();
    // `invisible` を外すと旧い文言が重なって見え、読み上げにも混ざる
    await expect.element(screen.getByText("2026/08/17 09:30")).toHaveStyle("visibility: hidden");
  });

  it("重ねるものが無ければ下敷きをそのまま見せる", async () => {
    const screen = await render(<HoldSize overlay={null}>2026/08/17 09:30</HoldSize>);

    await expect.element(screen.getByText("2026/08/17 09:30")).toBeVisible();
  });

  it("id は下敷きを包む要素に付き、aria-labelledby で指すと不可視でも名前に残る", async () => {
    const screen = await render(
      <button type="button" aria-labelledby="label">
        <HoldSize id="label" align="center" overlay={<span aria-hidden>…</span>}>
          保存
        </HoldSize>
      </button>,
    );

    await expect.element(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });
});
