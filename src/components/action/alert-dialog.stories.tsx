import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, screen } from "storybook/test";

import { AlertDialogActionButton } from "./alert-dialog";

/**
 * 確認ダイアログの確定ボタン。`ActionButton` に registry の `AlertDialogAction` と同じ
 * `data-slot` を足すだけの部品なので、pending や disabled といった状態の出し分けは
 * `button.stories.tsx` が持つ。ここで見るのは `data-slot` が付くことだけである。
 *
 * ダイアログへ組み込んだ形は `src/components/parts/delete-confirm-dialog.stories.tsx` が持つ。
 */
const meta = {
  component: AlertDialogActionButton,
  args: { children: "削除", variant: "destructive", action: fn() },
} satisfies Meta<typeof AlertDialogActionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** registry の `AlertDialogAction` と同じ `data-slot` が付く */
export const Default: Story = {
  play: async () => {
    await expect(screen.getByRole("button", { name: "削除" })).toHaveAttribute(
      "data-slot",
      "alert-dialog-action",
    );
  },
};
