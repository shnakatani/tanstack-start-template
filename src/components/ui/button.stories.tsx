import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "@/components/ui/button.story-helpers";

const meta = {
  component: Button,
  args: { children: "保存する" },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "select", options: BUTTON_SIZES },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。画面の主操作に使う */
export const Default: Story = {};

/** 副次の操作。主操作と並べても主従が読める */
export const Secondary: Story = {
  args: { variant: "secondary", children: "下書き保存" },
};

/** 枠だけ。ダイアログのキャンセルなど、押されない側に置く */
export const Outline: Story = {
  args: { variant: "outline", children: "キャンセル" },
};

/** 背景も枠も持たない。密度の高い場所で行を邪魔しない */
export const Ghost: Story = {
  args: { variant: "ghost", children: "詳細" },
};

/** 破線の枠。追加を促す空の枠として使う */
export const Dashed: Story = {
  args: { variant: "dashed", children: "項目を追加" },
};

/** 破壊操作。テキストを伴う場合は常時 destructive 色で出す (styling.md) */
export const Destructive: Story = {
  args: { variant: "destructive", children: "削除する" },
};

/**
 * 破壊操作のアイコンボタン。hover でのみ着色すると touch 環境で色が出ないため、
 * アイコン単体でも destructive 系の variant を当てる (styling.md)
 */
export const DestructiveIcon: Story = {
  args: {
    variant: "destructive-ghost",
    size: "icon",
    "aria-label": "削除する",
    children: <TrashIcon />,
  },
};

/** リンクの意匠。遷移を伴うなら `ButtonLink` (parts) を使う */
export const Link: Story = {
  args: { variant: "link", children: "詳細を見る" },
};

/** 操作できない状態 */
export const Disabled: Story = {
  args: { disabled: true },
};
