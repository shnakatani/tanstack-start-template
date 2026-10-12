import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { formatDateTime } from "@/lib/format-date-time";

import { DateTimeText } from "./date-time-text";

/** 数字の組み合わせが違う 2 つの瞬間。比例数字では "1" と "8" の幅が違う */
const NARROW_DIGITS = new Date("2026-01-11T02:11:00.000Z");
const WIDE_DIGITS = new Date("2026-08-18T09:48:00.000Z");

/**
 * 状態のカタログは `date-time-text.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * ここに残すのは、数字が違う 2 つの日時の幅が一致すること (2 回の観測の比較) と、`<time>` の機械可読の値で、
 * args だけで状態が決まる部品なので story に play が無く、ここでしか固定できない。
 */
describe("DateTimeText", () => {
  it("数字の組み合わせが違う日時でも幅が一致する", async () => {
    const screen = await render(
      <div className="flex flex-col items-start">
        <DateTimeText value={NARROW_DIGITS} />
        <DateTimeText value={WIDE_DIGITS} />
      </div>,
    );
    const narrow = screen.getByText(formatDateTime(NARROW_DIGITS));
    const wide = screen.getByText(formatDateTime(WIDE_DIGITS));
    await expect.element(wide).toBeInTheDocument();
    const widthNarrow = narrow.element().getBoundingClientRect().width;

    // `tabular-nums` を外すと、比例数字の分だけ幅が違う
    await expect
      .poll(() => wide.element().getBoundingClientRect().width)
      .toBeCloseTo(widthNarrow, 0);
  });

  it("基準タイムゾーンの壁時計を見せ、機械可読の値は ISO 8601 で持つ", async () => {
    const screen = await render(<DateTimeText value={WIDE_DIGITS} />);
    const time = screen.getByText(formatDateTime(WIDE_DIGITS));

    await expect.element(time).toHaveAttribute("datetime", "2026-08-18T09:48:00.000Z");
  });
});
