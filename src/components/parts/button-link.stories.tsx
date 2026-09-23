import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { BUTTON_SIZES, BUTTON_VARIANTS } from "@/components/ui/button.story-helpers";

import { ButtonLink } from "./button-link";

const meta = {
  component: ButtonLink,
  args: { to: "/notes", children: "メモ一覧へ" },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "select", options: BUTTON_SIZES },
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

/** Empty 状態の CTA が使う組み合わせ。テキストリンクの意匠のまま、WCAG 2.2 の 2.5.8 (24x24 CSS px) を満たす */
export const Link: Story = {
  args: { variant: "link", size: "sm", children: "新規登録する" },
};
