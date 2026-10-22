import { useMatch, useMatches } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CenteredCard } from "@/components/parts/centered-card";
import { PageHeader } from "@/components/parts/page-header";
import { CardPageTitle, type PageTitleTone } from "@/components/parts/page-title";
import { StatusHeading } from "@/components/parts/status-heading";
import { CardContent, CardHeader } from "@/components/ui/card";
import { usePageHeadingAbove } from "@/hooks/page-heading-context";
import { failureScreenLayout, type RouteFailureKind } from "@/lib/page-name";

/**
 * route の error と not found の画面の枠。見出しの形は `failureScreenLayout` が、失敗の位置と、名前の付いたページの
 * `PageOutlet` の中か (`usePageHeadingAbove`) から決める (ADR-0035)。
 * - 見出しの行: ページの見出しの行が画面に無く、名前の付いたページの位置で失敗したら、その名前の `PageHeader`
 *   (操作なし) を描く
 * - 失敗の見出し: `StatusHeading`。名前の付いたページの見出し (h1) の下なら h2、無ければ h1。遷移の後の focus の
 *   移し先になる
 * - 枠: 名前の付いたページが無ければ画面全体を占め (`fill="screen"`)、あればページの区画を占める (`fill="section"`)
 *
 * `useMatches` は select を付けずに読む。select で object を返すと、既定では structural sharing が効かず、
 * 描画のたびに新しい値になる
 */
export function RouteFailureScreen({
  kind,
  title,
  tone,
  children,
}: {
  kind: RouteFailureKind;
  /** 失敗の見出し */
  title: string;
  tone?: PageTitleTone;
  /** カードの本文 (説明と、次に取れる操作) */
  children: ReactNode;
}) {
  const ownMatchId = useMatch({ strict: false, select: (match) => match.id });
  const matches = useMatches();
  const underPageHeading = usePageHeadingAbove();
  const { headingRowName, failureHeadingLevel } = failureScreenLayout(
    matches,
    ownMatchId,
    kind,
    underPageHeading,
  );
  return (
    <>
      {headingRowName === undefined ? null : <PageHeader title={headingRowName} />}
      <CenteredCard fill={failureHeadingLevel === 1 ? "screen" : "section"}>
        {/* 本文が左寄せの段落と操作なので、見出しも中央寄せにしない */}
        <CardHeader>
          <CardPageTitle tone={tone}>
            <StatusHeading title={title} level={failureHeadingLevel} />
          </CardPageTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </CenteredCard>
    </>
  );
}
