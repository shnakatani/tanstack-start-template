import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, screen, userEvent } from "storybook/test";

import { SegmentedRadioGroup, SegmentedRadioGroupItem } from "./segmented-radio-group";

type FilterValue = "all" | "unread";

interface StoryArgs {
  /** 初期の選択 */
  value: FilterValue;
  onValueChange: (value: FilterValue) => void;
  disabled: boolean;
  /** 2 つ目の item にだけ渡す。group ではなく item 自身の属性で発火する */
  invalid: boolean;
}

/** 1 文字と 2 文字のラベルを混ぜる。min-w-12 による等幅化が見える */
function Filter({ value, onValueChange, disabled, invalid }: StoryArgs) {
  const [selected, setSelected] = useState<FilterValue>(value);

  return (
    <SegmentedRadioGroup
      aria-label="表示"
      value={selected}
      onValueChange={(next: FilterValue) => {
        onValueChange(next);
        setSelected(next);
      }}
      disabled={disabled}
    >
      <SegmentedRadioGroupItem value="all">全</SegmentedRadioGroupItem>
      <SegmentedRadioGroupItem value="unread" aria-invalid={invalid || undefined}>
        未読
      </SegmentedRadioGroupItem>
    </SegmentedRadioGroup>
  );
}

const meta = {
  title: "parts/SegmentedRadioGroup",
  // value は useState の初期値にしか効かないため、control で変えたら remount して反映する
  render: (args) => <Filter key={args.value} {...args} />,
  args: { value: "all", onValueChange: fn(), disabled: false, invalid: false },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。radiogroup と radio のロールを持つ */
export const Default: Story = {
  play: async () => {
    await expect(screen.getByRole("radiogroup", { name: "表示" })).toBeInTheDocument();
    await expect(screen.getAllByRole("radio")).toHaveLength(2);
  },
};

/** 未選択の項目をクリックすると onValueChange にその値を渡す */
export const Selecting: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("radio", { name: "未読" }));

    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith("unread");
  },
};

/** 選択済みの項目を再クリックしても空選択にならない */
export const ReclickKeepsSelection: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const selected = screen.getByRole("radio", { name: "全" });
    await userEvent.click(selected);

    // ToggleGroup と違い radio は解除経路を持たないため、変更通知そのものが起きない
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(selected).toHaveAttribute("aria-checked", "true");
    await expect(selected).toHaveAttribute("data-checked");
  },
};

/** 無効表示。base-ui の Radio.Root は span なので :disabled ではなく aria-disabled が付く */
export const Disabled: Story = { args: { disabled: true } };

/** item 自身の aria-invalid で destructive の枠色になる */
export const Invalid: Story = { args: { invalid: true } };
