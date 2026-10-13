import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Button } from "@/components/ui/button";

import { PendingLabel } from "./pending-label";

/** ボタンの中に置いて使う。pending の間も label が場所を取るので、ボタンの幅が変わらない */
const meta = {
  component: PendingLabel,
  args: { children: "保存" },
  render: (args) => (
    <Button>
      <PendingLabel {...args} />
    </Button>
  ),
} satisfies Meta<typeof PendingLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { isPending: false } };
export const Pending: Story = { args: { isPending: true } };
