import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { CenteredCard } from "@/components/parts/centered-card";
import { CardPageTitle } from "@/components/parts/page-title";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";
import { thrownValueMessage } from "@/lib/thrown-value-message";

/**
 * production の本文に出す固定文言。原因ではなく次に取れる行動だけを伝える
 * (`lib/mutation-error.ts` の `MUTATION_ERROR_FALLBACK_MESSAGE` と対になる意匠)。
 */
export const ROUTE_ERROR_FALLBACK_MESSAGE =
  "ページを表示できませんでした。時間をおいて再試行してください。";

/**
 * route エラー境界の共通表示。形は TanStack Router docs「External Data Loading」の
 * Error handling with TanStack Query の例に合わせる。
 *
 * - 再試行は `router.invalidate()` だけを呼ぶ。loader の再実行と route の error boundary の reset を
 *   router がまとめて行う (TanStack Router docs「Data Loading」の Handling Errors)
 * - 表示した時点で Query の error boundary を reset する。しないと、loader が取得しない
 *   `useSuspenseQuery` の失敗が Query のキャッシュに残り、再試行しても取得し直さずに同じエラーを
 *   投げ直す (`route-error.test.tsx` が見る)。表示した時点で reset するので、再試行せずに離れて
 *   戻ったときも取得し直す (同 docs の例の説明)
 */
export function RouteErrorContent({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  // 再実行の結果は loader と error boundary が受けるため待たない
  function handleRetry() {
    void router.invalidate();
  }

  return (
    <CenteredCard fill="section">
      {/* 本文が左寄せのため、見出しも中央寄せにしない */}
      <CardHeader>
        <CardPageTitle tone="destructive">
          <h1>エラーが発生しました</h1>
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
 * route 境界より上 (root) で落ちたエラーの全画面表示。document ごと差し替わるので、
 * route 側の `defaultErrorComponent` と違い背景から画面いっぱいに組む。
 *
 * 枠を持つのはこのファイルの責務にする。消費側 (`routes/__root.tsx`) が中央寄せの
 * class を持つと、枠と中身が別ファイルに分かれて片方だけの変更で崩れる。
 *
 * 高さは `h-screen` ではなく `min-h-svh` で取る (`centered-card.tsx` と同じ理由)。
 * 高さを viewport に固定すると、内容がそれより高いときに `items-center` がカードを
 * 上へはみ出させ、スクロールしても見出しに届かなくなる。
 */
export function FullScreenRouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <RouteErrorContent error={error} reset={reset} />
    </div>
  );
}
