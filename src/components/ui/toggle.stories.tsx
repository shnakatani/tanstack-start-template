import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BoldIcon } from "lucide-react";
import { expect, userEvent } from "storybook/test";

import { Toggle } from "@/components/ui/toggle";
import { TOGGLE_SIZES, TOGGLE_VARIANTS } from "@/components/ui/toggle.story-helpers";

const meta = {
  component: Toggle,
  args: { "aria-label": "太字", children: <BoldIcon /> },
  argTypes: {
    variant: { control: "inline-radio", options: TOGGLE_VARIANTS },
    size: { control: "inline-radio", options: TOGGLE_SIZES },
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
 * クリックで押下状態に移る。終了状態は Pressed と同じ見た目なのでカタログには出さない (ADR-0048)
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
