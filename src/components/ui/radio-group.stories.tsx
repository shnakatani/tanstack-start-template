import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, userEvent } from "storybook/test";

import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "draft", label: "下書きのみ" },
  { value: "archived", label: "アーカイブのみ" },
];

/**
 * 素の radio の集まり。区分けされた選択肢を並べる見た目は `SegmentedRadioGroup` (parts) が持つ
 */
const meta = {
  component: RadioGroup,
  args: { defaultValue: "all", "aria-label": "表示する範囲" },
  render: (args) => (
    <RadioGroup {...args}>
      {OPTIONS.map((option) => (
        <Field key={option.value} orientation="horizontal">
          <RadioGroupItem id={`radio-${option.value}`} value={option.value} />
          <FieldLabel htmlFor={`radio-${option.value}`}>{option.label}</FieldLabel>
        </Field>
      ))}
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。先頭が選ばれている */
export const Default: Story = {};

/** 別の項目が選ばれた状態 */
export const OtherSelected: Story = { args: { defaultValue: "archived" } };

/** 操作できない状態 */
export const Disabled: Story = { args: { disabled: true } };

/**
 * 選び直したところ。終了状態は OtherSelected と同じ見た目なのでカタログには出さない (ADR-0022)
 */
export const Selected: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    const target = canvas.getByRole("radio", { name: "下書きのみ" });
    await expect(target).not.toBeChecked();
    await userEvent.click(target);
    await expect(target).toBeChecked();
  },
};
