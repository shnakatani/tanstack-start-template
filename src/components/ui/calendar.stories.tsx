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

/** 既定。1 日だけ選ぶ */
export const Single: Story = {
  args: { selected: new Date(2026, 8, 18) },
};

/** 期間を選ぶ */
export const Range: Story = {
  args: {
    mode: "range",
    selected: { from: new Date(2026, 8, 14), to: new Date(2026, 8, 20) },
  },
};

/** 複数の日を選ぶ */
export const Multiple: Story = {
  args: {
    mode: "multiple",
    selected: [new Date(2026, 8, 3), new Date(2026, 8, 11), new Date(2026, 8, 25)],
  },
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
};
