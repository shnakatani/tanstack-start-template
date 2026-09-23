import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { InboxIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const meta = {
  component: Empty,
} satisfies Meta<typeof Empty>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 一覧が空のとき。見出しと、次に何ができるかを対で出す (shadcn の Empty docs は EmptyHeader で状態を、EmptyContent で次の操作を持たせる) */
export const Default: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>メモが登録されていません</EmptyTitle>
        <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};

/** 導線をボタンで添える形 */
export const WithAction: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>メモが登録されていません</EmptyTitle>
        <EmptyDescription>最初のメモを作ってみましょう</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">メモを追加</Button>
      </EmptyContent>
    </Empty>
  ),
};

/** `EmptyMedia` の `icon`。下地の付いた四角にアイコンを収める */
export const WithIconMedia: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>メモが登録されていません</EmptyTitle>
        <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};

/** `EmptyMedia` の `default`。下地を持たず、絵や大きめのアイコンをそのまま置く */
export const WithPlainMedia: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <InboxIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>メモが登録されていません</EmptyTitle>
        <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};
