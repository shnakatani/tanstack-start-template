import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>表示の設定</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>表示の設定</PopoverTitle>
          <PopoverDescription>一覧に出す列を選びます</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

/** 開くところまで。開いた先の操作は書かない (docs/guides/storybook.md「カタログと play の範囲」) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "表示の設定" }));
  await screen.findByRole("dialog");
}

const meta = {
  component: Popover,
  render: () => <PopoverExample />,
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/**
 * 開いた状態。portal へ出るので `screen` から取る。
 * `Dialog` と違って背面を塞がず、外側クリックと Esc で閉じる
 */
export const Opened: Story = {
  play: async () => {
    await open();
    await expect(screen.getByText("一覧に出す列を選びます")).toBeInTheDocument();
  },
};
