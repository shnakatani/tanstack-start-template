import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";
import { expect, userEvent } from "storybook/test";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TOGGLE_SIZES, TOGGLE_VARIANTS } from "@/components/ui/toggle.story-helpers";

const ITEMS = [
  { value: "left", label: "左寄せ", icon: <AlignLeftIcon /> },
  { value: "center", label: "中央寄せ", icon: <AlignCenterIcon /> },
  { value: "right", label: "右寄せ", icon: <AlignRightIcon /> },
];

const meta = {
  component: ToggleGroup,
  args: { "aria-label": "文字の揃え", defaultValue: ["left"] },
  argTypes: {
    variant: { control: "inline-radio", options: TOGGLE_VARIANTS },
    size: { control: "select", options: TOGGLE_SIZES },
    spacing: { control: { type: "number", min: 0, max: 4 } },
  },
  render: (args) => (
    <ToggleGroup {...args}>
      {ITEMS.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value} aria-label={item.label}>
          {item.icon}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。項目が離れて並ぶ */
export const Default: Story = {};

/** 枠を持つ形 */
export const Outline: Story = { args: { variant: "outline" } };

/** `spacing` を 0 にすると隣り合う角が落ちて 1 つの帯になる */
export const Connected: Story = { args: { variant: "outline", spacing: 0 } };

/** 縦並び */
export const Vertical: Story = { args: { orientation: "vertical", variant: "outline" } };

/**
 * 選び直したところ。終了状態は args で表せる見た目なのでカタログには出さない (ADR-0044)
 */
export const Toggled: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    const target = canvas.getByRole("button", { name: "中央寄せ" });
    await expect(target).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(target);
    await expect(target).toHaveAttribute("aria-pressed", "true");
  },
};
