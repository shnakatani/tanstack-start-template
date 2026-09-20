import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  buttonGroupVariants,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";

type ButtonGroupOrientation = NonNullable<VariantProps<typeof buttonGroupVariants>["orientation"]>;

/** control の選択肢の出処。`cva` に足した側がここで型エラーになる (ADR-0022) */
const ORIENTATION_MEMBERS = {
  horizontal: null,
  vertical: null,
} satisfies Record<ButtonGroupOrientation, null>;

const meta = {
  component: ButtonGroup,
  argTypes: {
    orientation: { control: "inline-radio", options: Object.keys(ORIENTATION_MEMBERS) },
  },
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline">左</Button>
      <Button variant="outline">中</Button>
      <Button variant="outline">右</Button>
    </ButtonGroup>
  ),
} satisfies Meta<typeof ButtonGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。隣り合う角を落として 1 つの塊に見せる */
export const Horizontal: Story = { args: { orientation: "horizontal" } };

/** 縦積み */
export const Vertical: Story = { args: { orientation: "vertical" } };

/** 区切りを挟む形 */
export const WithSeparator: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline">保存</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">複製</Button>
    </ButtonGroup>
  ),
};

/** 単位や接頭辞を添える形 */
export const WithText: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroupText>表示件数</ButtonGroupText>
      <Button variant="outline">20</Button>
      <Button variant="outline">50</Button>
    </ButtonGroup>
  ),
};
