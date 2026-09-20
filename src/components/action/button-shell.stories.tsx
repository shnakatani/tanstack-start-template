import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { ActionButtonShell } from "./button";

/**
 * pending を prop で受ける共通部。`ActionButton` は Transition から取った `isPending` を
 * これへ渡すだけなので、pending 中の描画はここで確かめられる。決着しない Promise を
 * 置かずに済み、a11y 検査も pending の状態に当たる (ADR-0022)
 */
const meta = {
  component: ActionButtonShell,
  args: { children: "保存" },
} satisfies Meta<typeof ActionButtonShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { isPending: false } };
export const Pending: Story = { args: { isPending: true } };
