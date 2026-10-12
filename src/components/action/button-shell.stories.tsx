import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { PlusIcon } from "lucide-react";

import { BUTTON_SIZES, BUTTON_VARIANTS } from "@/components/ui/button.story-helpers";

import { ActionButtonShell } from "./button";

/**
 * pending を prop で受ける共通部。`ActionButton` (`button.tsx`) も `ActionFormSubmit`
 * (`form.tsx`) も、Transition から取った `isPending` をこれへ渡すだけである。pending 中の
 * 描画はここで確かめられる。決着しない Promise を置かずに済み、a11y 検査も pending の
 * 状態に当たる (docs/guides/storybook.md「カタログと play の範囲」)。
 *
 * `ActionFormSubmit` 経由との差は `type` 属性 (`submit` / `button`) だけで、他の属性と
 * 子要素は一致する (2026-09-20 実測)。axe に `type` を入力にするルールは無い。
 */
const meta = {
  component: ActionButtonShell,
  args: { children: "保存" },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "select", options: BUTTON_SIZES },
  },
} satisfies Meta<typeof ActionButtonShell>;

export default meta;

type Story = StoryObj<typeof meta>;

// isPending は prop なので、対で並べると同じ部品の 2 状態として見比べられる。Idle は
// action/button の Default と同じ見た目になるが、別の部品の story なので残す (docs/guides/storybook.md「story を書く」)
export const Idle: Story = { args: { isPending: false } };
/** pending。label の幅のまま、Spinner だけが見える (ADR-0042) */
export const Pending: Story = { args: { isPending: true } };

/** icon だけのボタンの pending。Spinner が icon の場所に重なり、正方形から溢れない */
export const PendingIcon: Story = {
  args: { isPending: true, size: "icon", "aria-label": "追加", children: <PlusIcon /> },
};
