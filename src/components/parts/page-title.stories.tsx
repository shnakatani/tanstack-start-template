import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Card, CardHeader } from "@/components/ui/card";

import { CardPageTitle } from "./page-title";

const meta = {
  component: CardPageTitle,
  render: (args) => (
    <Card>
      <CardHeader>
        <CardPageTitle {...args} />
      </CardHeader>
    </Card>
  ),
} satisfies Meta<typeof CardPageTitle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: <h1>通知の見出し</h1> },
};

export const Destructive: Story = {
  args: { tone: "destructive", children: <h1>エラーが発生しました</h1> },
};
