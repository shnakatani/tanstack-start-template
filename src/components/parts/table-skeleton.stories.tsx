import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { TableSkeleton } from "./table-skeleton";

const meta = {
  component: TableSkeleton,
  args: {
    caption: "メモの一覧",
    columns: [
      { header: "タイトル", size: 200 },
      { header: "本文", size: 240 },
      { header: "期日", size: 112 },
      { header: "操作", size: 136 },
    ],
  },
} satisfies Meta<typeof TableSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
