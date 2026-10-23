import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

/**
 * カードを中央寄せする外枠。
 *
 * Card は自身を中央寄せできない (Card の flex は子の配置) ため、中央寄せの flex コンテナを
 * 別要素で用意する。p-6 は狭幅 (375px) でカードが画面端に接するのを防ぐ。
 *
 * `fill` は占める高さの選択。`h-screen` ではなく `min-h-svh` を使うのは、100vh が mobile の
 * ブラウザ chrome 分だけ表示領域を超えるため。高さを viewport に固定すると、内容がそれより
 * 高いときに `items-center` がカードを上へはみ出させ、スクロールしても見出しに届かなくなる。
 */
const centeredCardFrame = cva("flex items-center justify-center p-6", {
  variants: {
    fill: {
      /** 画面全体を占める。名前の付いたページが無い位置の失敗の画面 (`RouteFailureScreen`) 用 */
      screen: "min-h-svh bg-background",
      /** 画面の一部を占める。名前の付いたページの区画の中の失敗の画面 (`RouteFailureScreen`) 用 */
      section: "min-h-[50vh]",
    },
  },
  defaultVariants: {
    fill: "screen",
  },
});

type CenteredCardFill = NonNullable<VariantProps<typeof centeredCardFrame>["fill"]>;

/**
 * 中央寄せの 1 枚カード。カードの寸法 (`w-full max-w-sm`) はここだけが持つ。
 * 消費側が `Card` を直接組むと、幅を変えたときに片方だけ旧幅で残る。
 */
export function CenteredCard({ fill, children }: { fill?: CenteredCardFill; children: ReactNode }) {
  return (
    <div className={centeredCardFrame({ fill })}>
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}
