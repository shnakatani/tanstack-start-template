import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  SegmentedRadioGroup,
  SegmentedRadioGroupItem,
} from "@/components/parts/segmented-radio-group";
import { waitForAnimations } from "@/test/wait-for-animations";

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
 * ロールの確認と選択の通知は `segmented-radio-group.stories.tsx` の play が持つ (ADR-0022)。
 * ここに残すのは寸法と色を getComputedStyle / getBoundingClientRect で固定する回帰と、
 * 実イベントでなければ確かめられないものだけ。
 */
describe("SegmentedRadioGroup", () => {
  it("ラベルの文字数が違ってもセグメントが等幅になる", async () => {
    const screen = await render(<Filter />);

    const [one, two] = screen
      .getByRole("radio")
      .all()
      .map((locator) => locator.element().getBoundingClientRect().width);
    expect(one).toBeGreaterThan(0);
    expect(one).toBe(two);
  });

  it("トラックは 36px で、セグメントはその内側に収まる", async () => {
    const screen = await render(<Filter />);

    const track = screen.getByRole("radiogroup", { name: "表示" }).element();
    const segment = screen.getByRole("radio", { name: "全", exact: true }).element();
    expect(track.getBoundingClientRect().height).toBe(36);
    expect(segment.getBoundingClientRect().height).toBeLessThan(36);
  });

  it("選択済みの項目に hover しても文字色が奪われない", async () => {
    const screen = await render(<Filter />);

    const selected = screen.getByRole("radio", { name: "全", exact: true }).element();
    const restingColor = getComputedStyle(selected).color;

    await userEvent.hover(selected);
    // transition-all の途中値を読まないよう遷移の完了を待つ
    await waitForAnimations();

    // 選択時の文字色と hover 時の文字色が別トークンだと、data-checked が :where() 包みで
    // 特異度ゼロ加算のため hover に負ける。実際に bg-foreground を当てていた時期に
    // 前景と背景が同一色になり文字が完全に消えた (実測 1.004:1) ので、回帰として固定する
    expect(getComputedStyle(selected).color).toBe(restingColor);
  });

  it("item に aria-invalid を渡すと destructive の枠色になる", async () => {
    const screen = await render(
      <Filter>
        <SegmentedRadioGroupItem value="all">全</SegmentedRadioGroupItem>
        <SegmentedRadioGroupItem value="unread" aria-invalid>
          未読
        </SegmentedRadioGroupItem>
      </Filter>,
    );

    // aria-invalid: は自要素セレクタなので group ではなく item に渡して発火させる
    const invalid = screen.getByRole("radio", { name: "未読" }).element();
    const valid = screen.getByRole("radio", { name: "全", exact: true }).element();
    expect(getComputedStyle(invalid).borderColor).not.toBe(getComputedStyle(valid).borderColor);
  });

  it("キーボードフォーカス時に outline が実際に描画される", async () => {
    await render(<Filter />);

    await userEvent.tab();
    const focused = document.activeElement;
    expect.assert(focused instanceof HTMLElement, "フォーカスが要素に乗らなかった");
    expect(focused.getAttribute("role")).toBe("radio");

    // ring は box-shadow なので forced-colors / ハイコントラストでは描画されない。outline が
    // 併記されていても outline-none が同居していると --tw-outline-style: none に潰され、
    // outline-width だけ効いて描画はゼロになる。実効の outline-style で固定する
    const style = getComputedStyle(focused);
    expect(focused.matches(":focus-visible")).toBe(true);
    expect(style.outlineStyle).not.toBe("none");
    expect(style.outlineWidth).not.toBe("0px");
  });

  it("disabled でポインタを受け付けず、無効表示が効く", async () => {
    const screen = await render(<Filter disabled />);

    const target = screen.getByRole("radio", { name: "未読" }).element();
    expect(target.getAttribute("aria-disabled")).toBe("true");

    // クリックが届かないことは pointer-events で見る。合成 click を対象へ直接送って
    // base-ui 内部のガードまで確かめない。上流の担当で、base-ui 自身のテストが持つ (ADR-0015)
    const style = getComputedStyle(target);
    expect(style.opacity).toBe("0.5");
    expect(style.pointerEvents).toBe("none");
  });

  it("className は上書きできる形でマージされる", async () => {
    const screen = await render(<Filter className="w-full" />);

    const track = screen.getByRole("radiogroup", { name: "表示" }).element();
    // 素の w-fit を消費側の w-full が上書きする (registry と同じ cn によるマージ)
    expect(track.getBoundingClientRect().width).toBe(
      track.parentElement?.getBoundingClientRect().width,
    );
  });
});
