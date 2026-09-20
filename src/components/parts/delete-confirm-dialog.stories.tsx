import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useEffect, useState } from "react";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";

import { AlertDialogTrigger, createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createSettlingAction } from "@/test/settling-action";

import { DeleteConfirmDialog, type DeleteTarget } from "./delete-confirm-dialog";
import { deleteConfirmDescription } from "./delete-confirm-dialog.test-helpers";

const TARGET: DeleteTarget = { id: "w1", name: "田中太郎" };

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Action の Transition が残ると後続 story の
 * useTransition が entangle して pending のまま止まる (2026-09-20 実測)。
 *
 * 決着の時点は play が `settling.settle()` で握る。仕組みと理由は
 * `src/test/settling-action.ts` が持つ。play は必ず決着させてから終える。
 */
const settling = createSettlingAction();
const settlingConfirm = fn(settling.impl);

interface StoryArgs {
  entityLabel: string;
  description?: (name: string) => string;
  onConfirm: (target: DeleteTarget) => Promise<void> | void;
  target: DeleteTarget;
}

/**
 * Trigger を介さず handle だけで開く。imperative open では payload が入らないので、
 * 確定しても onConfirm を呼ばず warn だけが残る経路になる。
 * mount 時の open は DOM 副作用なので useEffect に置く (implementation.md)。
 * `target` は Trigger が payload へ載せる値なので、この経路では使わない
 */
function WithoutTrigger({ target: _target, ...props }: StoryArgs) {
  const [handle] = useState(() => createAlertDialogHandle<DeleteTarget>());
  useEffect(() => {
    handle.open(null);
  }, [handle]);
  return <DeleteConfirmDialog handle={handle} {...props} />;
}

function WithTrigger({ target, ...props }: StoryArgs) {
  const [handle] = useState(() => createAlertDialogHandle<DeleteTarget>());
  return (
    <>
      <AlertDialogTrigger handle={handle} payload={target} render={<Button />}>
        開く
      </AlertDialogTrigger>
      <DeleteConfirmDialog handle={handle} {...props} />
    </>
  );
}

async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "開く" }));
  await screen.findByRole("button", { name: "削除" });
}

const meta = {
  render: (args) => <WithTrigger {...args} />,
  args: { entityLabel: "ユーザー", target: TARGET, onConfirm: fn() },
  // 開始時に持ち越しを捨て、終了時に全決着させる。play が途中で落ちても未決着を残さない
  beforeEach: settling.beforeEach,
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じた状態。Trigger だけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.getByRole("button", { name: "開く" })).toBeInTheDocument();
    await expect(screen.queryByText("ユーザーの削除")).not.toBeInTheDocument();
  },
};

/** 開いた状態 */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByText("ユーザーの削除")).toBeInTheDocument();
    await expect(screen.getByText(deleteConfirmDescription("田中太郎"))).toBeInTheDocument();
  },
};

/** entityLabel と payload の name が反映される */
export const OtherEntity: Story = {
  args: { entityLabel: "タグ", target: { id: "v1", name: "重要" } },
  play: async () => {
    await open();
    await expect(screen.getByText("タグの削除")).toBeInTheDocument();
    await expect(screen.getByText(deleteConfirmDescription("重要"))).toBeInTheDocument();
  },
};

/** description で既定文言を上書きする */
export const CustomDescription: Story = {
  args: {
    entityLabel: "メモ",
    description: (name: string) => `「${name}」と紐づくタグをまとめて削除しますか？`,
  },
  play: async () => {
    await open();
    await expect(
      screen.getByText("「田中太郎」と紐づくタグをまとめて削除しますか？"),
    ).toBeInTheDocument();
    await expect(screen.queryByText(deleteConfirmDescription("田中太郎"))).not.toBeInTheDocument();
  },
};

/** 削除で payload を伴って onConfirm が呼ばれる */
export const Confirmed: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "削除" }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).toHaveBeenCalledWith(TARGET);
  },
};

/** キャンセルで閉じる */
export const Cancelled: Story = {
  tags: ["!dev"],
  play: async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    // 閉じるアニメーションが終わるまで DOM に残る
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "削除" })).not.toBeInTheDocument(),
    );
  },
};

/** 決着まで pending になり、決着すると戻る */
export const Pending: Story = {
  tags: ["!dev"],
  args: { onConfirm: settlingConfirm },
  play: async () => {
    await open();
    const confirm = screen.getByRole("button", { name: "削除" });
    confirm.focus();
    await userEvent.keyboard("{Enter}");
    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await expect(confirm).toHaveAttribute("aria-disabled", "true");
    settling.settle();
    await waitFor(() => expect(confirm).toHaveAttribute("aria-busy", "false"));
  },
};

/** 決着前の 2 回目では呼ばない */
export const NotCalledTwice: Story = {
  tags: ["!dev"],
  args: { onConfirm: settlingConfirm },
  play: async ({ args }) => {
    await open();
    const confirm = screen.getByRole("button", { name: "削除" });
    confirm.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).toHaveBeenCalledWith(TARGET);
    settling.settle();
    await waitFor(() => expect(confirm).toHaveAttribute("aria-busy", "false"));
  },
};

/** payload なしで開かれたら warn して呼ばない */
export const WithoutPayload: Story = {
  // 終了状態は Opened とほぼ同じ見た目 (payload なしでは説明文が空になるだけ) なので
  // カタログには出さない (ADR-0022)
  tags: ["!dev"],
  render: (args) => <WithoutTrigger {...args} />,
  play: async ({ args }) => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await userEvent.click(await screen.findByRole("button", { name: "削除" }));
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(warn).toHaveBeenCalledWith(
      "[DeleteConfirmDialog] confirm clicked with no payload",
      { entityLabel: "ユーザー" },
    );
  },
};
