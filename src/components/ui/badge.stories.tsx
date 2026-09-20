import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** control の選択肢の出処。`cva` に足した側がここで型エラーになる (ADR-0022) */
const VARIANT_MEMBERS = {
  default: null,
  secondary: null,
  destructive: null,
  outline: null,
  ghost: null,
  link: null,
} satisfies Record<BadgeVariant, null>;

const meta = {
  component: Badge,
  args: { children: "下書き" },
  argTypes: {
    variant: { control: "select", options: Object.keys(VARIANT_MEMBERS) },
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

/** リンクとして描くとき。`render` で `<a>` に差し替えて使う */
export const Link: Story = { args: { variant: "link" } };
