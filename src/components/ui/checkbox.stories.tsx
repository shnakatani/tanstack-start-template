import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, userEvent } from "storybook/test";

import { Checkbox } from "@/components/ui/checkbox";

const meta = {
  component: Checkbox,
  args: { "aria-label": "アーカイブ済みを含める" },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 未選択。フォームの中では `FormCheckboxField`、複数選択の一覧は `ChoiceCard` (parts) を通す */
export const Unchecked: Story = {};

/** 選択済み。カタログなので非制御の初期値で描く */
export const Checked: Story = {
  args: { defaultChecked: true },
};

/** どちらでもない状態。親が子を部分的に含むときに使う。横棒は ADR-0027 の乖離で足したもの */
export const Indeterminate: Story = {
  args: { indeterminate: true },
};

/** 操作できない状態 */
export const Disabled: Story = {
  args: { defaultChecked: true, disabled: true },
};

/** 検証に落ちた状態。枠線とリングが destructive に変わる */
export const Invalid: Story = {
  args: { "aria-invalid": true },
};

/**
 * クリックで選択に移る。状態が変わるところまでを play が持つ。
 * 終了状態は Checked と同じ見た目なのでカタログには出さない (ADR-0053)
 */
export const Toggled: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox", { name: "アーカイブ済みを含める" });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
