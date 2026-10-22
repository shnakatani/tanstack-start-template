import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { StatusHeading } from "./status-heading";

const meta = {
  component: StatusHeading,
} satisfies Meta<typeof StatusHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: "エラーが発生しました", level: 1 },
};
