import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";

import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

/**
 * `children` を渡すと registry の既定の Track と Indicator が描かれない (ADR-0006 の乖離)。
 * 素の形は `children` を渡さずフォールバックに任せる
 */
const meta = {
  component: Progress,
  // role="progressbar" は名前が要る。`ProgressLabel` を置かない形では aria-label で与える
  args: { value: 60, "aria-label": "アップロードの進捗" },
  argTypes: { value: { control: { type: "range", min: 0, max: 100 } } },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 進捗の途中 */
export const Default: Story = {};

/** 開始前 */
export const Empty: Story = { args: { value: 0 } };

/** 完了 */
export const Complete: Story = { args: { value: 100 } };

/** 総量が分からないとき。`value` に `null` を渡すと indeterminate になる */
export const Indeterminate: Story = { args: { value: null } };

/** 見出しと数値を添えた形。children を組むときは Track と Indicator を自分で置く */
export const WithLabel: Story = {
  // meta の aria-label を外す。ProgressLabel があると base-ui が aria-labelledby を出し、
  // そちらが優先されるので aria-label は効かない。残すと、ProgressLabel からの命名が
  // 壊れても meta の名前で story が緑のまま通る
  args: { "aria-label": undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar")).toHaveAccessibleName("アップロード中");
  },
  render: (args) => (
    <Progress {...args}>
      <div className="flex w-full items-center justify-between text-sm">
        <ProgressLabel>アップロード中</ProgressLabel>
        <ProgressValue />
      </div>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  ),
};
