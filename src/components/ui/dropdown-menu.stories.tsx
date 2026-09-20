import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 項目は必ず `DropdownMenuGroup` の中に置く (`implementation.md`「Item は Group の中に置く」)。
 * 全項目を包む単一の Group には名前を与えない。base-ui がトリガー由来の名前を popup へ付ける
 */
function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>操作</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            開く
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>複製する</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">削除する</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 開くところまで。選択は書かない (ADR-0022) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "操作" }));
  await screen.findByRole("menu");
}

const meta = {
  component: DropdownMenu,
  render: () => <DropdownMenuExample />,
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  },
};

/** 開いた状態。portal へ出るので `screen` から取る */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByRole("menuitem", { name: /開く/ })).toBeInTheDocument();
  },
};

/**
 * 2 グループ以上に分けるときは `DropdownMenuLabel` で各グループに名前を与える
 * (`implementation.md`「accessible name の与え方」)
 */
export const Grouped: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>操作</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>表示</DropdownMenuLabel>
          <DropdownMenuItem>開く</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>編集</DropdownMenuLabel>
          <DropdownMenuItem>複製する</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">削除する</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async () => {
    await open();
    await expect(screen.getByText("編集")).toBeInTheDocument();
  },
};
