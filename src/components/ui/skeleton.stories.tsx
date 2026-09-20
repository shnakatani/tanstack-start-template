import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton は寸法を持たず、置かれた場所の形をなぞる部品。story から `className` は渡さず、
 * 寸法は decorator の器から与える (`directory-structure.md`「コンポーネント配置」)。
 * `grid` の器に置くと子が両軸いっぱいに伸びる。
 * 実際の一覧の待機表示は `TableSkeleton` (parts) が持つ
 */
const meta = {
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1 行ぶん。文字列の高さに合わせた帯 */
export const Line: Story = {
  decorators: [
    (Story) => (
      <div className="grid h-4 w-48">
        <Story />
      </div>
    ),
  ],
};

/** 見出しと本文を積んだ形 */
export const Paragraph: Story = {
  decorators: [
    (Story) => (
      <div className="grid w-64 grid-rows-[1.25rem_1rem_1rem] gap-2">
        <Story />
        <Story />
        <Story />
      </div>
    ),
  ],
};

/** 画像やアイコンの枠ぶん。器の寸法をそのままなぞる */
export const Block: Story = {
  decorators: [
    (Story) => (
      <div className="grid size-10">
        <Story />
      </div>
    ),
  ],
};
