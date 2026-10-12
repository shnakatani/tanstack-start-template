import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useId, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "@/components/ui/button.story-helpers";

import { PendingLabel } from "./pending-label";

/**
 * ボタンの中身として描く。label を不可視にして Spinner を重ねるので、ボタンの名前は `aria-labelledby` で
 * label を指して保つ (`ActionButtonShell` と `ButtonLink` が同じ形で張る。ADR-0042)。
 */
function LabelledButton({
  isPending,
  children,
  ...button
}: ComponentProps<typeof PendingLabel> & Pick<ComponentProps<typeof Button>, "variant" | "size">) {
  const labelId = useId();
  return (
    <Button {...button} aria-labelledby={labelId} disabled={isPending} focusableWhenDisabled>
      <PendingLabel id={labelId} isPending={isPending}>
        {children}
      </PendingLabel>
    </Button>
  );
}

const meta = {
  args: { children: "保存", isPending: false },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "select", options: BUTTON_SIZES },
  },
  render: (args) => <LabelledButton {...args} />,
} satisfies Meta<typeof LabelledButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 待機していない。label がそのまま見える */
export const Idle: Story = {};

/** pending。label の幅のまま、Spinner だけが見える */
export const Pending: Story = {
  args: { isPending: true },
};
