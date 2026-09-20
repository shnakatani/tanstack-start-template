import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CardSize = NonNullable<ComponentProps<typeof Card>["size"]>;

/** control の選択肢の出処。`cva` の増減が両方向でここの型エラーになる (`directory-structure.md`「コンポーネント配置」) */
const SIZE_OPTIONS = Object.keys({
  default: null,
  sm: null,
} satisfies Record<CardSize, null>);

const meta = {
  component: Card,
  argTypes: {
    size: { control: "inline-radio", options: SIZE_OPTIONS },
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>買い物リスト</CardTitle>
        <CardDescription>週末に買うもの</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            編集
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>牛乳、パン、卵</CardContent>
      <CardFooter>
        <Button size="sm">開く</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 既定。余白は `--card-spacing` が持つ (`styling.md`「spacing 基準」)。
 * 全画面センタリングは `CenteredCard`、カード内のページ見出しは `CardPageTitle` (どちらも parts)
 */
export const Default: Story = {};

/** 余白を 1 段詰めた形。`size` が `--card-spacing` を切り替える */
export const Small: Story = {
  args: { size: "sm" },
};

/** ヘッダー帯だけの形。`CardAction` が右側の操作を受け持つ */
export const HeaderOnly: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>買い物リスト</CardTitle>
        <CardAction>
          <Button size="sm" variant="ghost">
            編集
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  ),
};
