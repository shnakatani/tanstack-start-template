import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";

import { CenteredCard } from "./centered-card";
import { CardPageTitle } from "./page-title";

const meta = {
  component: CenteredCard,
  args: {
    children: (
      <>
        <CardHeader>
          <CardPageTitle>
            <h1>エラーが発生しました</h1>
          </CardPageTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">ページを表示できませんでした。</p>
          <Button className="self-start">再試行</Button>
        </CardContent>
      </>
    ),
  },
} satisfies Meta<typeof CenteredCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 画面全体を占める (`fill` 省略時の既定)。名前の付いたページが無い位置の失敗の画面用 */
export const Default: Story = {};

/** 画面の一部を占める。名前の付いたページの区画の中の失敗の画面用 */
export const Section: Story = {
  args: { fill: "section" },
};

/**
 * 375px 幅。外枠の p-6 があるのでカードが画面端に接せず、横スクロールも出ない。
 * 寸法は測らず、この story で見る (測っても Tailwind の定義を言い直すだけになる)。addon-vitest も同じ viewport で描画する
 */
export const Narrow: Story = {
  globals: { viewport: { value: "narrow", isRotated: false } },
};
