import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Spinner } from "@/components/ui/spinner";

import { HoldSize } from "./hold-size";

/**
 * 下敷きの寸法を保ったまま操作中の表示を重ねる器 (ADR-0042)。重ねるものの有無で箱の幅が変わらないことを、
 * 同じ下敷きの 2 つを並べて見比べる。
 */
const meta = {
  component: HoldSize,
  args: { children: "2026/08/17 09:30", overlay: null },
  argTypes: {
    align: { control: "select", options: ["start", "center"] },
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col items-start gap-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HoldSize>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 重ねるものが無い。下敷きがそのまま見える */
export const Idle: Story = {};

/** 文言を重ねる。下敷きの日時は見えず、箱の幅は日時のまま */
export const Overlay: Story = {
  args: { overlay: "更新中" },
};

/** 図を中央に重ねる。ボタンの pending (`PendingLabel`) が使う形 */
export const Centered: Story = {
  args: { children: "保存", overlay: <Spinner aria-hidden />, align: "center" },
};
