import type { ErrorComponentProps } from "@tanstack/react-router";

import { CenteredCard } from "@/components/parts/centered-card";
import { CardPageTitle } from "@/components/parts/page-title";
import { StatusHeading } from "@/components/parts/status-heading";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";
import { useRouteRetry } from "@/hooks/use-route-retry";
import { thrownValueMessage } from "@/lib/thrown-value-message";

import { RoutePageHeader } from "./route-page-header";

/**
 * production の本文に出す固定文言。原因ではなく次に取れる行動だけを伝える
 * (`lib/mutation-error.ts` の `MUTATION_ERROR_FALLBACK_MESSAGE` と対になる意匠)。
 */
export const ROUTE_ERROR_FALLBACK_MESSAGE =
  "ページを表示できませんでした。時間をおいて再試行してください。";

const ROUTE_ERROR_TITLE = "エラーが発生しました";

/**
 * route のエラーの画面の本体 (失敗の見出し、説明、再試行)。ページの位置で受ける `PageRouteError` と、root で受ける
 * `FullScreenRouteError` が描く。再試行の組み方は `useRouteRetry` が持つ。
 *
 * `headingLevel` は失敗の見出しの level。ページ名の `<h1>` の下では 2 にし、遷移の後の focus を引く印を付ける
 * (`StatusHeading`)。1 は画面にほかの `<h1>` が無いときで、印が無くても focus は最初の `<h1>` としてここへ移る (ADR-0035)
 */
export function RouteErrorContent({
  error,
  headingLevel,
}: {
  error: unknown;
  headingLevel: 1 | 2;
}) {
  const handleRetry = useRouteRetry();

  return (
    <CenteredCard fill="section">
      {/* 本文が左寄せのため、見出しも中央寄せにしない */}
      <CardHeader>
        <CardPageTitle tone="destructive">
          {headingLevel === 2 ? (
            <StatusHeading title={ROUTE_ERROR_TITLE} />
          ) : (
            <h1>{ROUTE_ERROR_TITLE}</h1>
          )}
        </CardPageTitle>
      </CardHeader>
      <CardContent>
        {/* 例外の文言は DEV でだけ出す。production では client に届く文言が汎用のものに差し替わり、
              server で描く HTML もここで固定文言にする。判定は serverErrorAdapter と同じく
              import.meta.env.DEV を直接読み、production の bundle から DEV の分岐を落とす (ADR-0038)。
              原因は server のログと、ブラウザの console (React が既定で出す) で追う */}
        <p className="text-muted-foreground">
          {import.meta.env.DEV ? thrownValueMessage(error) : ROUTE_ERROR_FALLBACK_MESSAGE}
        </p>
        <Button onClick={handleRetry} className="self-start">
          再試行
        </Button>
      </CardContent>
    </CenteredCard>
  );
}

/**
 * ページの位置で受けるエラーの画面。ページの route が自分の `errorComponent` に置く (ADR-0044)。ページを置き換え、
 * 自分の route の `pageName` の見出しの行を描いて、失敗の見出しを `<h2>` にする。見出しの行に操作は出さない。
 * 操作はページの state を持ち、失敗したページには無い。
 *
 * `pageName` の無い route に置くと `RoutePageHeader` が throw し、その throw はこの境界の外の祖先 (無ければ root) の
 * errorComponent が受ける
 */
export function PageRouteError({ error }: ErrorComponentProps) {
  return (
    <div>
      <RoutePageHeader />
      <RouteErrorContent error={error} headingLevel={2} />
    </div>
  );
}

/**
 * root で受けたエラーの全画面表示。root の component を置き換えて描かれるので、背景から画面いっぱいに組む。
 * 文書の骨格 (`<html>`) は root の shell (`routes/__root.tsx`) が持つ (ADR-0045)。
 *
 * 枠を持つのはこのファイルの責務にする。消費側 (`routes/__root.tsx`) が中央寄せの
 * class を持つと、枠と中身が別ファイルに分かれて片方だけの変更で崩れる。
 *
 * 高さは `h-screen` ではなく `min-h-svh` で取る (`centered-card.tsx` と同じ理由)。
 * 高さを viewport に固定すると、内容がそれより高いときに `items-center` がカードを
 * 上へはみ出させ、スクロールしても見出しに届かなくなる。
 */
export function FullScreenRouteError({ error }: ErrorComponentProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <RouteErrorContent error={error} headingLevel={1} />
    </div>
  );
}
