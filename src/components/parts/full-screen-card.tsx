import { cn } from "cn";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 全画面に 1 枚のカードを中央寄せする外枠。
 *
 * Card は自身を中央寄せできない (Card の flex は子の配置) ため、中央寄せの flex コンテナを
 * 別要素で用意する。h-screen ではなく min-h-svh を使うのは、100vh が mobile のブラウザ
 * chrome 分だけ表示領域を超えるため。p-6 は狭幅 (375px) でカードが画面端に接するのを防ぐ。
 */
export function FullScreenCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}

type FullScreenCardTitleTone = "default" | "destructive";

/**
 * tone ごとの上乗せ class。Record にするのは、union にメンバーを足したときここへの追記漏れを
 * 型検査で落とすため (三項演算子だと既定の見た目で黙って描かれる)。
 */
const FULL_SCREEN_CARD_TITLE_TONE_CLASSES: Record<FullScreenCardTitleTone, string> = {
  default: "",
  destructive: "text-destructive",
};

/**
 * 全画面カードのページ見出し。registry の `CardTitle` は text-base / font-medium で
 * カード内の小見出しの寸法なので、ページ全体の見出しはこの部品を通す
 * (`styling.md` の typography 階層)。tone は意味色の出し分けで、破壊的な文脈にだけ使う。
 */
export function FullScreenCardTitle({
  tone = "default",
  children,
}: {
  tone?: FullScreenCardTitleTone;
  children: ReactNode;
}) {
  return (
    <CardTitle className={cn("text-lg font-semibold", FULL_SCREEN_CARD_TITLE_TONE_CLASSES[tone])}>
      {children}
    </CardTitle>
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
    <FullScreenCard>
      <CardHeader className="text-center">
        <FullScreenCardTitle>
          <h1>{title}</h1>
        </FullScreenCardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </FullScreenCard>
  );
}
