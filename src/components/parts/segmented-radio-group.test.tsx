import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  SegmentedRadioGroup,
  SegmentedRadioGroupItem,
} from "@/components/parts/segmented-radio-group";
import { resolveColorToken } from "@/test/resolve-color-token";

/** 1 文字と 2 文字のラベルを混ぜる。等幅化の検証に使う */
function Filter({
  value = "all",
  onValueChange = vi.fn(),
  disabled = false,
  className,
  children,
}: {
  value?: "all" | "unread";
  onValueChange?: (value: "all" | "unread") => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <SegmentedRadioGroup
      aria-label="表示"
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={className}
    >
      {children ?? (
        <>
          <SegmentedRadioGroupItem value="all">全</SegmentedRadioGroupItem>
          <SegmentedRadioGroupItem value="unread">未読</SegmentedRadioGroupItem>
        </>
      )}
    </SegmentedRadioGroup>
  );
}

/**
 * ロールの確認と選択の通知は `segmented-radio-group.stories.tsx` の play が持ち、等幅・
 * トラックの高さ・aria-invalid の枠色・className のマージは同 story の状態カタログで見る
 * (ADR-0048)。寸法は測らない。寸法は tabs の registry の値を写したもので、上流が決める (ADR-0026)。
 *
 * ここに残すのは Playwright の実 pointer / 実キーボードでしか確かめられない 3 件。story の
 * `userEvent.hover` は合成イベントで CSS の `:hover` を立てないため、hover と選択色の衝突は
 * ここでしか再現しない。
 */
describe("SegmentedRadioGroup", () => {
  it("選択済みの項目に hover しても文字色が奪われない", async () => {
    const screen = await render(<Filter />);

    const selected = screen.getByRole("radio", { name: "全", exact: true });
    const foreground = resolveColorToken("--foreground");
    await expect.element(selected).toHaveStyle(`color: ${foreground}`);

    // transition-all は browser-setup の reduced motion で 0.01ms になり、settled 状態を即座に読める (ADR-0042)
    await userEvent.hover(selected);

    // 選択時の文字色と hover 時の文字色が別トークンだと、data-checked が :where() 包みで
    // 特異度ゼロ加算のため hover に負ける。実際に bg-foreground を当てていた時期に
    // 前景と背景が同一色になり文字が完全に消えた (実測 1.004:1) ので、回帰として固定する
    await expect.element(selected).toHaveStyle(`color: ${foreground}`);
  });

  it("キーボードフォーカス時に outline が実際に描画される", async () => {
    const screen = await render(<Filter />);

    // radiogroup では Tab が選択中の項目に乗る
    await userEvent.tab();
    const focused = screen.getByRole("radio", { name: "全", exact: true });
    await expect.element(focused).toHaveFocus();

    // ring は box-shadow なので forced-colors / ハイコントラストでは描画されない。outline が
    // 併記されていても outline-none が同居していると --tw-outline-style: none に潰され、
    // outline-width だけ効いて描画はゼロになる。style の有無で見る (値は measure しない)
    await expect.element(focused).toHaveStyle("outline-style: solid");
  });

  it("disabled で無効表示が効き、ポインタが届かない指定を持つ", async () => {
    const screen = await render(<Filter disabled />);

    const item = screen.getByRole("radio", { name: "未読" });

    await expect.element(item).toHaveAttribute("aria-disabled", "true");
    // クリックが届かないことは pointer-events の指定で見る。イベントを対象へ届かせて
    // base-ui 内部のガードまで確かめない。上流の担当で、base-ui 自身のテストが持つ (ADR-0041)
    await expect.element(item).toHaveStyle("opacity: 0.5; pointer-events: none");
  });
});
