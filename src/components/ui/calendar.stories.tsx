import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Calendar } from "@/components/ui/calendar";

/** カタログを月替わりで動かさないよう、表示する月を固定する */
const MONTH = new Date(2026, 8, 1);

const meta = {
  component: Calendar,
  args: { mode: "single", defaultMonth: MONTH },
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

/** 月をドロップダウンで選べる形 */
export const WithDropdownCaption: Story = {
  args: { captionLayout: "dropdown" },
};

/** 選べない日を持つ形 */
export const WithDisabledDays: Story = {
  args: { disabled: { before: new Date(2026, 8, 10) } },
};
