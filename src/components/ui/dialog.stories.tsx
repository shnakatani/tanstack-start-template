import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * handle は story ごとに作る。module 変数に持たせると前の story の開閉状態が残る
 */
function DialogExample({ showCloseButton }: { showCloseButton?: boolean }) {
  const [handle] = useState(() => createDialogHandle<undefined>());
  return (
    <>
      <DialogTrigger handle={handle} render={<Button />}>
        メモを追加
      </DialogTrigger>
      <Dialog handle={handle}>
        <DialogContent showCloseButton={showCloseButton}>
          <DialogHeader>
            <DialogTitle>メモを追加</DialogTitle>
            <DialogDescription>タイトルを入力して追加します</DialogDescription>
          </DialogHeader>
          <Label htmlFor="dialog-title">タイトル</Label>
          <Input id="dialog-title" placeholder="タイトルを入力" />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
            <Button>追加する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 開くところまで。開いた先の操作は既存のブラウザテストが持つ (ADR-0046) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "メモを追加" }));
  await screen.findByRole("dialog");
}

const meta = {
  component: Dialog,
  render: () => <DialogExample />,
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** 開いた状態。portal へ出るので `screen` から取る */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "メモを追加" })).toBeInTheDocument();
    // 閉じる X は registry 既定の名前 (Close) を持つ。WithoutCloseButton の否定と対で意味を持つ
    await expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  },
};

/**
 * `DialogContent` の閉じる X を出さない形。footer のキャンセルボタン (`DialogClose`) が tab 順に
 * 残るので、閉じる button は失われない (WAI-ARIA APG の Dialog (Modal) Pattern は、閉じる
 * button を tab 順に置くことを推奨している)。
 * X を消しても Esc と外側クリックは効いたまま
 */
export const WithoutCloseButton: Story = {
  render: () => <DialogExample showCloseButton={false} />,
  play: async () => {
    await open();
    await expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  },
};
