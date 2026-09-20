import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";

import { ButtonLink } from "./button-link";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/**
 * control の選択肢の出処。Storybook の `options` は `readonly any[]` で中身を検査しないので、
 * リテラルを並べるだけだと `cva` に足したときに静かに古くなる。`satisfies Record<..., null>`
 * に通すと、足した側がここで型エラーになる (2026-09-20 実測)。
 */
const VARIANT_MEMBERS = {
  default: null,
  outline: null,
  secondary: null,
  ghost: null,
  dashed: null,
  destructive: null,
  "destructive-ghost": null,
  link: null,
} satisfies Record<ButtonVariant, null>;

const SIZE_MEMBERS = {
  default: null,
  xs: null,
  sm: null,
  lg: null,
  icon: null,
  "icon-xs": null,
  "icon-sm": null,
  "icon-lg": null,
} satisfies Record<ButtonSize, null>;

const meta = {
  component: ButtonLink,
  args: { to: "/notes", children: "メモ一覧へ" },
  argTypes: {
    variant: {
      control: "select",
      options: Object.keys(VARIANT_MEMBERS),
    },
    size: {
      control: "select",
      options: Object.keys(SIZE_MEMBERS),
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
