import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Calendar } from "@/components/ui/calendar";

/**
 * カタログを時計で動かさないよう、月と「今日」を固定する。`defaultMonth` だけでは
 * `today` modifier が実時計を読み続け、月が変わると強調の位置が消える
 */
const MONTH = new Date(2026, 8, 1);
const TODAY = new Date(2026, 8, 20);

const meta = {
  component: Calendar,
  args: { mode: "single", defaultMonth: MONTH, today: TODAY },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 見出しを axe の対象から外す。registry 素の nav が `absolute inset-x-0 top-0` で見出しへ
 * 重なるため、axe は背景を決められない (bgOverlap)。nav は透明なので実際の配色は変わらない。
 * ルールごと切らずに要素で外すのは、日付セルの色の検査を残すため (ADR-0026 の節 4)。
 * 外せるのは registry baseline の差分で nav の位置指定が変わったとき (ADR-0006 の検査手順)。
 * `captionLayout="dropdown"` では出ないので、その story には付けない
 */
const EXCLUDE_CAPTION = { a11y: { context: { exclude: [".rdp-caption_label"] } } };

/** 既定。1 日だけ選ぶ */
export const Single: Story = {
  args: { selected: new Date(2026, 8, 18) },
  parameters: EXCLUDE_CAPTION,
};

/** 期間を選ぶ */
export const Range: Story = {
  args: {
    mode: "range",
    selected: { from: new Date(2026, 8, 14), to: new Date(2026, 8, 20) },
  },
  parameters: {
    a11y: {
      context: {
        exclude: [
          ...EXCLUDE_CAPTION.a11y.context.exclude,
          // 期間の両端も registry 素。`after:w-4 after:bg-muted` の擬似要素で隣のセルへ橋を
          // 架けており、axe は一定以上の面積を持つ擬似要素があると背景の判定を打ち切る
          // (pseudoContent)。擬似要素の色はセル自身と同じ bg-muted なので実際の比は変わらない。
          // 同じ対を range_middle のセルが検査し続ける
          '[data-range-start="true"]',
          '[data-range-end="true"]',
        ],
      },
    },
  },
};

/** 複数の日を選ぶ */
export const Multiple: Story = {
  args: {
    mode: "multiple",
    selected: [new Date(2026, 8, 3), new Date(2026, 8, 11), new Date(2026, 8, 25)],
  },
  parameters: EXCLUDE_CAPTION,
};

/**
 * 月と年をドロップダウンで選べる形。年の範囲を明示しないと
 * `today` から前 100 年で組まれ、選択肢が毎年 1 つ増える
 */
export const WithDropdownCaption: Story = {
  args: {
    captionLayout: "dropdown",
    startMonth: new Date(2020, 0, 1),
    endMonth: new Date(2030, 11, 31),
  },
};

/** 選べない日を持つ形 */
export const WithDisabledDays: Story = {
  args: { disabled: { before: new Date(2026, 8, 10) } },
  parameters: EXCLUDE_CAPTION,
};
