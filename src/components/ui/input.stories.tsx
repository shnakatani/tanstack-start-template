import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Input } from "@/components/ui/input";

const meta = {
  component: Input,
  args: { "aria-label": "メモのタイトル", placeholder: "タイトルを入力" },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。空欄に placeholder だけが見えている状態。フォームの中では `FormTextField` (parts) を通す */
export const Default: Story = {};

/** 値が入っている状態。カタログなので非制御の初期値で描く */
export const Filled: Story = {
  args: { defaultValue: "買い物リスト" },
};

/** 操作できない状態。背景ではなく不透明度で落とす */
export const Disabled: Story = {
  args: { defaultValue: "買い物リスト", disabled: true },
};

/**
 * 検証に落ちた状態。枠線とリングが destructive に変わる。
 * 見た目の切り替えは `aria-invalid` が持つので、色を当てる側で分岐させない
 */
export const Invalid: Story = {
  args: { defaultValue: "", "aria-invalid": true },
};

/** 日付など type で見た目と入力 UI が変わるもの */
export const DateInput: Story = {
  args: { type: "date", "aria-label": "期日", placeholder: undefined },
};
