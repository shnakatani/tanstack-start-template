import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress";

const meta = {
  component: Progress,
  // role="progressbar" は名前が要る。`ProgressLabel` を置かない形では aria-label で与える
  args: { value: 60, "aria-label": "アップロードの進捗" },
  argTypes: { value: { control: { type: "range", min: 0, max: 100 } } },
  render: (args) => (
    <Progress {...args}>
      <ProgressTrack />
    </Progress>
  ),
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 進捗の途中 */
export const Default: Story = {};

/** 開始前 */
export const Empty: Story = { args: { value: 0 } };

/** 完了 */
export const Complete: Story = { args: { value: 100 } };

/**
 * 総量が分からないとき。`value` に `null` を渡すと indeterminate になる。
 * `children` を渡すと既定の Track は描かれない (ADR-0006 の乖離)
 */
export const Indeterminate: Story = { args: { value: null } };

/** 見出しと数値を添えた形 */
export const WithLabel: Story = {
  render: (args) => (
    <Progress {...args}>
      <div className="flex items-center justify-between text-sm">
        <ProgressLabel>アップロード中</ProgressLabel>
        <ProgressValue />
      </div>
      <ProgressTrack />
    </Progress>
  ),
};
