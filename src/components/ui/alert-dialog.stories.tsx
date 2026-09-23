import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, screen, userEvent, within } from "storybook/test";

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
 * handle は story ごとに作る。module 変数に持たせると前の story の開閉状態が残る。
 * アプリの確認ダイアログは `DeleteConfirmDialog` (parts) を通すので、ここは registry の意匠の見本
 */
function AlertDialogExample({ media }: { media?: ReactNode }) {
  const [handle] = useState(() => createAlertDialogHandle<undefined>());
  return (
    <>
      <AlertDialogTrigger handle={handle} render={<Button variant="destructive" />}>
        削除する
      </AlertDialogTrigger>
      <AlertDialog handle={handle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {media}
            <AlertDialogTitle>メモの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「買い物リスト」を削除します。元に戻せません
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** 開くところまで。開いた先の操作は既存のブラウザテストが持つ (ADR-0044) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "削除する" }));
  await screen.findByRole("alertdialog");
}

const meta = {
  component: AlertDialog,
  render: () => <AlertDialogExample />,
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
 * 開いた状態。role は `alertdialog` で、`Dialog` と違って閉じる X を持たない。
 * 外側クリックでは閉じない (base-ui が alert-dialog のとき `disablePointerDismissal` を固定する)
 * が、Esc は閉じる。フッターで閉じるのは `AlertDialogCancel` だけで、`AlertDialogAction` は
 * 素の `Button` なので閉じない
 */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "メモの削除" })).toBeInTheDocument();
    // X が無いことは件数で示す。`Dialog` の Close は sr-only の "Close" を持つが
    // alert-dialog には無く、名前での否定は常に真になる
    await expect(within(screen.getByRole("alertdialog")).getAllByRole("button")).toHaveLength(2);
  },
};

/** アイコンを添えた形。`AlertDialogMedia` は `sm` 以上で見出しの左、`sm` 未満で上に置く */
export const WithMedia: Story = {
  render: () => (
    <AlertDialogExample
      media={
        <AlertDialogMedia>
          <TriangleAlertIcon aria-hidden />
        </AlertDialogMedia>
      }
    />
  ),
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "メモの削除" })).toBeInTheDocument();
  },
};
