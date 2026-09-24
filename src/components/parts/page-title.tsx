import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { CardTitle } from "@/components/ui/card";

/**
 * ページ見出しの外見。
 *
 * `PageHeader` の `<h1>` と `CardPageTitle` の `CardTitle` が同じ寸法を持つ必要があるが、
 * 器 (header の中か Card の中か) が違うので部品は分かれる。外見だけをここが持ち、両方が消費する。
 * それぞれが class を書くと、片方だけ変えても何も落ちないまま 2 つのページ見出しがずれる。
 *
 * `cva` にするのは、tone を足したときの追記漏れを `VariantProps` が型で落とすため。手組みの
 * `Record` でも型は効くが、variant を読める仕組みがプロジェクトに 2 つできる (`@shadcn/lint` が
 * 読めるのは `cva` と `tv`)。
 */
export const pageTitle = cva("text-lg font-semibold", {
  variants: {
    /** 意味色の出し分け。破壊的な文脈にだけ destructive を使う */
    tone: {
      default: "",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type PageTitleTone = NonNullable<VariantProps<typeof pageTitle>["tone"]>;

/**
 * Card の中に置くページ見出し。registry の `CardTitle` は text-base / font-medium で
 * カード内の小見出しの寸法なので、ページ全体の見出しはこの部品を通す。
 *
 * 器を 1 つの外枠に限らないのは、カードで組む表示が複数あり、占める高さだけが違うため
 * (`CenteredCard` の `fill`)。見出しの所有をどれか 1 つへ寄せると、別の器を使う画面が寸法を手で書く。
 */
export function CardPageTitle({ tone, children }: { tone?: PageTitleTone; children: ReactNode }) {
  return <CardTitle className={pageTitle({ tone })}>{children}</CardTitle>;
}
