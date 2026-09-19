import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { ButtonLink } from "./button-link";

const meta = {
  component: ButtonLink,
  args: { to: "/notes", children: "メモ一覧へ" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "dashed",
        "destructive",
        "destructive-ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
} satisfies Meta<typeof ButtonLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Destructive: Story = {
  args: { variant: "destructive" },
};

/** Empty 状態の CTA が使う組み合わせ。テキストリンクの意匠のまま touch target の床を満たす (ADR-0007) */
export const Link: Story = {
  args: { variant: "link", size: "sm", children: "新規登録する" },
};
