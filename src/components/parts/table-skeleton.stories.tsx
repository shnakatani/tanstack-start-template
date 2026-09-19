import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { TableSkeleton } from "./table-skeleton";

const meta = {
  component: TableSkeleton,
  args: { columns: 4 },
} satisfies Meta<typeof TableSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
