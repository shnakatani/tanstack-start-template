import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { TriangleAlertIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// alertVariants は registry が export していないので、部品の props から導出する
type AlertVariant = NonNullable<ComponentProps<typeof Alert>["variant"]>;

/** control の選択肢の出処。`cva` の増減が両方向でここの型エラーになる (`directory-structure.md`「コンポーネント配置」) */
const VARIANT_OPTIONS = Object.keys({
  default: null,
  destructive: null,
} satisfies Record<AlertVariant, null>);

const meta = {
  component: Alert,
  argTypes: {
    variant: { control: "inline-radio", options: VARIANT_OPTIONS },
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>下書きを復元しました</AlertTitle>
      <AlertDescription>前回の入力内容をそのまま開いています</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。画面の中に留め置く知らせ。操作を止める必要があるなら `AlertDialog` を使う */
export const Default: Story = {};

/** 異常や失敗。色だけで伝えないようアイコンか文言を添える (`styling.md`「色は semantic token のみ」) */
export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>保存できませんでした</AlertTitle>
      <AlertDescription>通信を確認してもう一度お試しください</AlertDescription>
    </Alert>
  ),
};

/** 操作を添える形。`AlertAction` が右側を受け持つ */
export const WithAction: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>下書きを復元しました</AlertTitle>
      <AlertDescription>前回の入力内容をそのまま開いています</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline">
          破棄する
        </Button>
      </AlertAction>
    </Alert>
  ),
};
