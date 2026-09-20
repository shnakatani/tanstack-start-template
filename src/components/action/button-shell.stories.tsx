import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { ActionButtonShell } from "./button";

/**
 * pending を prop で受ける共通部。`ActionButton` (`button.tsx`) も `ActionFormSubmit`
 * (`form.tsx`) も、Transition から取った `isPending` をこれへ渡すだけである。pending 中の
 * 描画はここで確かめられる。決着しない Promise を置かずに済み、a11y 検査も pending の
 * 状態に当たる (ADR-0022)。
 *
 * `ActionFormSubmit` 経由との差は `type` 属性 (`submit` / `button`) だけで、他の属性と
 * 子要素は一致する (2026-09-20 実測)。axe に `type` を入力にするルールは無い。
 */
const meta = {
  component: ActionButtonShell,
  args: { children: "保存" },
} satisfies Meta<typeof ActionButtonShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { isPending: false } };
export const Pending: Story = { args: { isPending: true } };
