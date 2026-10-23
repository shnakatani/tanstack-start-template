import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { CardTitle, type cardTitleVariants } from "@/components/ui/card";

export type PageTitleTone = NonNullable<VariantProps<typeof cardTitleVariants>["tone"]>;

/**
 * Card の中に置くページ見出し。registry の `CardTitle` の既定は text-base / font-medium で
 * カード内の小見出しの寸法なので、ページ全体の見出しはこの部品を通す。寸法は `CardTitle` の
 * `size="page"` が持ち、`PageHeader` の `<h1>` と共有する。
 *
 * 器を 1 つの外枠に限らないのは、カードで組む表示が複数あり、占める高さだけが違うため
 * (`CenteredCard` の `fill`)。見出しの所有をどれか 1 つへ寄せると、別の器を使う画面が寸法を手で書く。
 */
export function CardPageTitle({ tone, children }: { tone?: PageTitleTone; children: ReactNode }) {
  return (
    <CardTitle size="page" tone={tone}>
      {children}
    </CardTitle>
  );
}
