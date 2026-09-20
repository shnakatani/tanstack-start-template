import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import type { ToastIconType } from "@/components/ui/toast";
import { createToastManager, Toaster } from "@/components/ui/toast";

/**
 * 見出しの文言。`toast.tsx` の対応表を出処にしているので、icon を持つ種別が増減すると
 * ここが型エラーになる (ADR-0022)
 */
const TYPE_LABELS = {
  success: "保存しました",
  info: "下書きを復元しました",
  warning: "接続が不安定です",
  error: "保存できませんでした",
  loading: "保存しています",
} satisfies Record<ToastIconType, string>;

/**
 * manager は story ごとに作る。module 変数に持たせると前の story の toast が残る (ADR-0022)
 */
function ToastExample({ type }: { type: ToastIconType }) {
  const [manager] = useState(() => createToastManager());
  function handleClick() {
    manager.add({ type, title: TYPE_LABELS[type], description: "メモ「買い物リスト」" });
  }
  return (
    <Toaster toastManager={manager}>
      <Button onClick={handleClick}>通知を出す</Button>
    </Toaster>
  );
}

/** 出すところまで。閉じる操作は既存のブラウザテストが持つ (ADR-0022) */
async function raise(title: string): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "通知を出す" }));
  await screen.findByText(title);
}

const meta = {
  render: ({ type }: { type: ToastIconType }) => <ToastExample type={type} />,
  args: { type: "success" },
  argTypes: {
    type: { control: "select", options: Object.keys(TYPE_LABELS) },
  },
  // 各 story は args の type だけを持つ。`Empty` は自前の play で上書きする
  play: async ({ args }) => {
    await raise(TYPE_LABELS[args.type]);
  },
} satisfies Meta<{ type: ToastIconType }>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 通知が出ていない状態。トリガーだけが見える */
export const Empty: Story = {
  play: async () => {
    await expect(screen.queryByText(TYPE_LABELS.success)).not.toBeInTheDocument();
  },
};

/** 成功。操作が通ったことを伝える */
export const Success: Story = {
  args: { type: "success" },
};

/** エラー。`toastMutationError` が使う型 (src/lib/mutation-error.ts) */
export const ErrorToast: Story = {
  args: { type: "error" },
};

/** 警告 */
export const Warning: Story = {
  args: { type: "warning" },
};

/** 情報 */
export const Info: Story = {
  args: { type: "info" },
};

/** 進行中。アイコンが回り続ける */
export const Loading: Story = {
  args: { type: "loading" },
};
