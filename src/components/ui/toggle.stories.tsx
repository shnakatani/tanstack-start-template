import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { VariantProps } from "class-variance-authority";
import { BoldIcon } from "lucide-react";
import { expect, userEvent } from "storybook/test";

import { Toggle, toggleVariants } from "@/components/ui/toggle";

type ToggleVariant = NonNullable<VariantProps<typeof toggleVariants>["variant"]>;
type ToggleSize = NonNullable<VariantProps<typeof toggleVariants>["size"]>;

/** control の選択肢の出処。`cva` に足した側がここで型エラーになる (ADR-0022) */
const VARIANT_MEMBERS = {
  default: null,
  outline: null,
} satisfies Record<ToggleVariant, null>;

const SIZE_MEMBERS = {
  default: null,
  sm: null,
  lg: null,
} satisfies Record<ToggleSize, null>;

const meta = {
  component: Toggle,
  args: { "aria-label": "太字", children: <BoldIcon /> },
  argTypes: {
    variant: { control: "inline-radio", options: Object.keys(VARIANT_MEMBERS) },
    size: { control: "inline-radio", options: Object.keys(SIZE_MEMBERS) },
  },
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。押されていない状態は背景を持たない */
export const Default: Story = {};

/** 押された状態。`aria-pressed` が背景を切り替える */
export const Pressed: Story = {
  args: { defaultPressed: true },
};

/** 枠を持つ形。単独で置いてもボタンだと分かる */
export const Outline: Story = {
  args: { variant: "outline" },
};

/** 操作できない状態 */
export const Disabled: Story = {
  args: { disabled: true },
};

/**
 * クリックで押下状態に移る。終了状態は Pressed と同じ見た目なのでカタログには出さない (ADR-0022)
 */
export const Toggled: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "太字" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  },
};
