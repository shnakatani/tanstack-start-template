import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Spinner } from "@/components/ui/spinner";

const meta = {
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 素の Spinner。`role="status"` と `aria-label` を自分で持つ。
 * ボタンの中へ置くときは使う側が `aria-hidden` を渡す (ADR-0037)
 */
export const Default: Story = {};
