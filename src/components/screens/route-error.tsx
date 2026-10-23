import type { ErrorComponentProps } from "@tanstack/react-router";

import { RouteFailureScreen } from "@/components/screens/route-failure-screen";
import { Button } from "@/components/ui/button";
import { useRouteRetry } from "@/hooks/use-route-retry";
import { thrownValueMessage } from "@/lib/thrown-value-message";

/**
 * production の本文に出す固定文言。原因ではなく次に取れる行動だけを伝える
 * (`lib/mutation-error.ts` の `MUTATION_ERROR_FALLBACK_MESSAGE` と対になる意匠)。
 */
export const ROUTE_ERROR_FALLBACK_MESSAGE =
  "ページを表示できませんでした。時間をおいて再試行してください。";

/**
 * route エラー境界の共通表示。router の `defaultErrorComponent` と root の `errorComponent` が描く。
 * 見出しの行と失敗の見出しの level、枠の大きさは `RouteFailureScreen` が失敗の位置から決める。
 * 再試行の組み方は `useRouteRetry` が持つ
 */
export function RouteErrorContent({ error }: ErrorComponentProps) {
  const handleRetry = useRouteRetry();

  return (
    <RouteFailureScreen kind="error" title="エラーが発生しました" tone="destructive">
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
    </RouteFailureScreen>
  );
}
