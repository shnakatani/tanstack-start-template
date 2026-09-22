import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { StaleContent } from "./stale-content";

const meta = {
  component: StaleContent,
  args: { stale: false, children: "検索結果の一覧" },
} satisfies Meta<typeof StaleContent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 最新の内容。そのまま描く */
export const Fresh: Story = {};

/** 新しい内容を待っている間。半透明 + aria-busy */
export const Stale: Story = { args: { stale: true } };
