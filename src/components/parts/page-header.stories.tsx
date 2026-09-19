import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Button } from "@/components/ui/button";

import { PageHeader } from "./page-header";

const meta = {
  component: PageHeader,
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: "メモ一覧" },
};

export const WithActions: Story = {
  args: {
    title: "メモ一覧",
    actions: <Button size="sm">メモを追加</Button>,
  },
};
