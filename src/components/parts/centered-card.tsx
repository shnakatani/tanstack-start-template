import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { CardPageTitle } from "@/components/parts/page-title";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
      /** 画面全体を占める。遷移先を失った画面 (404 / 認証エラー / root の error boundary) 用 */
      screen: "min-h-svh bg-background",
      /** 画面の一部を占める。周りに他の要素が残る route の error boundary 用 */
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

/**
 * 見出し・説明・操作を 1 セットだけ持つ全画面の通知。
 * 認証エラーや 404 のように、遷移先を失ったユーザーへ状況と次の一手だけを示す画面で使う。
 *
 * 見出しは `CardTitle` の中に h1 を入れて組む。shadcn は CardTitle を h3 から div へ変えて
 * 見出し階層を利用側の裁量にしており (shadcn-ui/ui #8440 / #10301 は 2026-08-07 時点で
 * いずれも open、asChild / render は未提供)、この合成が registry を触らずに済む唯一の手段。
 * Tailwind preflight が h1 の font-size / weight を inherit へ落とすため見た目は div のときと同一
 * (実測: 18px / 600 / lh 28px / margin 0 / 高さ 28px で一致)。data-slot も CardTitle 側に残る。
 * これらの画面はサイドバーを持たない単独画面なので h1 が正しい階層になる。
 */
export function FullScreenNotice({
  title,
  description,
  children,
}: {
  title: string;
  /** `<p>` の中身として描画するため、flow content を持てない (現状の消費は全て文字列) */
  description: string;
  children: ReactNode;
}) {
  return (
    <CenteredCard>
      <CardHeader className="text-center">
        <CardPageTitle>
          <h1>{title}</h1>
        </CardPageTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </CenteredCard>
  );
}
