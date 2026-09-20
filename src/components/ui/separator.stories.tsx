import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { ComponentProps } from "react";

import { Separator } from "@/components/ui/separator";

type SeparatorOrientation = NonNullable<ComponentProps<typeof Separator>["orientation"]>;

/** control の選択肢の出処。`cva` の増減が両方向でここの型エラーになる (`directory-structure.md`「コンポーネント配置」) */
const ORIENTATION_OPTIONS = Object.keys({
  horizontal: null,
  vertical: null,
} satisfies Record<SeparatorOrientation, null>);

const meta = {
  component: Separator,
  argTypes: {
    orientation: { control: "inline-radio", options: ORIENTATION_OPTIONS },
  },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。親の幅いっぱいに 1px の横線を引く */
export const Horizontal: Story = {
  args: { orientation: "horizontal" },
};

/**
 * 縦線。`self-stretch` で親の高さに合わせるため、高さを持つ flex の親が要る。
 * 高さは story の外側で与える (部品へ className を渡さない、ADR-0022)
 */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  decorators: [
    (Story) => (
      <div className="flex h-12 items-stretch gap-4">
        <span className="self-center text-sm">左</span>
        <Story />
        <span className="self-center text-sm">右</span>
      </div>
    ),
  ],
};
