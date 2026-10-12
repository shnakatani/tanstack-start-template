import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { DateTimeText } from "./date-time-text";

const meta = {
  component: DateTimeText,
  args: { value: new Date("2026-08-17T00:30:00.000Z") },
} satisfies Meta<typeof DateTimeText>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 基準タイムゾーン (`APP_TIME_ZONE`) の壁時計。数字は `tabular-nums` で等幅 */
export const Default: Story = {};

/** 数字の組み合わせが違う 2 つを縦に並べる。桁がそろい、右端も一致する */
export const Aligned: Story = {
  render: () => (
    <div className="flex flex-col items-start">
      <DateTimeText value={new Date("2026-01-11T02:11:00.000Z")} />
      <DateTimeText value={new Date("2026-08-18T09:48:00.000Z")} />
    </div>
  ),
};
