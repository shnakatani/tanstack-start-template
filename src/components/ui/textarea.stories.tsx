import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Textarea } from "@/components/ui/textarea";

const meta = {
  component: Textarea,
  args: { "aria-label": "メモの本文", placeholder: "本文を入力" },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。`min-h-16` の高さから始まる */
export const Default: Story = {};

/** 複数行が入っている状態 */
export const Filled: Story = {
  args: { defaultValue: "牛乳\nパン\n卵" },
};

/** 操作できない状態 */
export const Disabled: Story = {
  args: { defaultValue: "牛乳\nパン\n卵", disabled: true },
};

/** 検証に落ちた状態。切り替えは `aria-invalid` が持つ */
export const Invalid: Story = {
  args: { defaultValue: "", "aria-invalid": true },
};
