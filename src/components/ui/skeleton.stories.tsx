import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * 寸法の API が `className` しかない部品なので、story も消費側と同じ形で描く。
 * 寸法は layout の class なので、story の className を layout に限る範囲に収まる (ADR-0048)。
 * 実際の一覧の待機表示は `TableSkeleton` (parts) が持つ
 */
const meta = {
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1 行ぶん。`table-skeleton.tsx` の見出しセルと同じ寸法 */
export const Line: Story = {
  args: { className: "h-4 w-16" },
};

/** 本文のセル。最大幅を持たせて伸ばす */
export const Cell: Story = {
  args: { className: "h-8 w-full max-w-48" },
};

/** アイコンの枠。`sidebar.tsx` の待機表示と同じ形 */
export const Icon: Story = {
  args: { className: "size-4" },
};
