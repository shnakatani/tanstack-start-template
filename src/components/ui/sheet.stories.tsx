import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { ComponentProps } from "react";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { variantOptions } from "./variant-options.story-helpers";

type SheetSide = NonNullable<ComponentProps<typeof SheetContent>["side"]>;

const SIDE_OPTIONS = variantOptions({
  top: null,
  right: null,
  bottom: null,
  left: null,
} satisfies Record<SheetSide, null>);

function SheetExample({ side }: { side?: SheetSide }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>絞り込み</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>絞り込み</SheetTitle>
          <SheetDescription>条件を選んで一覧を絞り込みます</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>閉じる</SheetClose>
          <Button>適用する</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** 開くところまで。開いた先の操作は既存のブラウザテストが持つ (ADR-0046) */
async function open(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "絞り込み" }));
  await screen.findByRole("dialog");
}

// side は SheetContent の prop なので component もそちらを指す。Sheet を指すと args の型と
// 食い違い、agent 向けの `storybook tools docs show` からも Props が消える
const meta = {
  component: SheetContent,
  argTypes: {
    side: { control: "inline-radio", options: SIDE_OPTIONS },
  },
  render: ({ side }: { side?: SheetSide }) => <SheetExample side={side} />,
} satisfies Meta<{ side?: SheetSide }>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** 既定の右から。幅は `sm:max-w-sm` で頭打ちになる */
export const Right: Story = {
  args: { side: "right" },
  play: async () => {
    await open();
    await expect(screen.getByRole("heading", { name: "絞り込み" })).toBeInTheDocument();
  },
};

/** 左から。ナビゲーションを差し込むとき */
export const Left: Story = {
  args: { side: "left" },
  play: open,
};

/** 上から。高さは内容に合わせる */
export const Top: Story = {
  args: { side: "top" },
  play: open,
};

/** 下から。片手で届く位置に操作を置きたいとき */
export const Bottom: Story = {
  args: { side: "bottom" },
  play: open,
};
