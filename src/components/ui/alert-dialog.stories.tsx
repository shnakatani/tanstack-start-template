import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogHandle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * handle は story ごとに作る。module 変数にすると、1 つの React root へ story を描き替える
 * Storybook の vitest 実行で開閉状態が次の story へ持ち越される。
 * アプリの確認ダイアログは `DeleteConfirmDialog` (parts) を通すので、ここは registry の意匠の見本
 */
function AlertDialogExample({ children }: { children: ReactNode }) {
  const [handle] = useState(() => createAlertDialogHandle<undefined>());
  return (
    <>
      <AlertDialogTrigger handle={handle} render={<Button variant="destructive" />}>
        削除する
      </AlertDialogTrigger>
      <AlertDialog handle={handle}>
        <AlertDialogContent>{children}</AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const BODY = (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>メモの削除</AlertDialogTitle>
      <AlertDialogDescription>「買い物リスト」を削除します。元に戻せません</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>キャンセル</AlertDialogCancel>
      <AlertDialogAction variant="destructive">削除</AlertDialogAction>
    </AlertDialogFooter>
  </>
);

/** 開くところまで。開いた先の操作は既存のブラウザテストが持つ (ADR-0022) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "削除する" }));
  await screen.findByRole("alertdialog");
}

const meta = {
  component: AlertDialog,
  render: () => <AlertDialogExample>{BODY}</AlertDialogExample>,
} satisfies Meta<typeof AlertDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  },
};

/**
 * 開いた状態。`Dialog` と違って X を持たず、閉じる手段はフッターの 2 つだけになる。
 * role も `alertdialog` で、外側クリックや Esc では閉じない
 */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "メモの削除" })).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  },
};

/** アイコンを添えた形。`AlertDialogMedia` が見出しの上に置く枠を持つ */
export const WithMedia: Story = {
  render: () => (
    <AlertDialogExample>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <TriangleAlertIcon aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>メモの削除</AlertDialogTitle>
        <AlertDialogDescription>
          「買い物リスト」を削除します。元に戻せません
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>キャンセル</AlertDialogCancel>
        <AlertDialogAction variant="destructive">削除</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogExample>
  ),
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "メモの削除" })).toBeInTheDocument();
  },
};
