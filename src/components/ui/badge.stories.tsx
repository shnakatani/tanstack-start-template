import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";

import { variantOptions } from "./variant-options.story-helpers";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const VARIANT_OPTIONS = variantOptions({
  default: null,
  secondary: null,
  destructive: null,
  outline: null,
  ghost: null,
  link: null,
} satisfies Record<BadgeVariant, null>);

const meta = {
  component: Badge,
  args: { children: "下書き" },
  argTypes: {
    variant: { control: "select", options: VARIANT_OPTIONS },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。状態や分類を本文の脇に添える */
export const Default: Story = {};

/** 強調を落とす。既定と並べても主従が読める */
export const Secondary: Story = { args: { variant: "secondary" } };

/** 破壊的・異常を示す */
export const Destructive: Story = { args: { variant: "destructive" } };

/** 枠だけ。背景色を持つ要素の上に重ねても沈まない */
export const Outline: Story = { args: { variant: "outline" } };

/** 背景も枠も持たない。密度の高い一覧で行の区切りを邪魔しない */
export const Ghost: Story = { args: { variant: "ghost" } };

/**
 * リンクとして描くとき。既定のタグは `span` なので `render` で `<a>` に差し替える。
 * hover の指定が `[a]:` 限定なので、差し替えないとリンクとしての見た目が出ない
 */
export const Link: Story = {
  args: { variant: "link" },
  render: ({ children, ...args }) => <Badge {...args} render={<a href="/notes">{children}</a>} />,
};
