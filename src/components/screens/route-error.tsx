import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

import { CenteredCard } from "@/components/parts/centered-card";
import { CardPageTitle } from "@/components/parts/page-title";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader } from "@/components/ui/card";
import { exposesServerErrorDetails } from "@/lib/server-error-exposure";
import { thrownValueMessage } from "@/lib/thrown-value-message";

/**
 * production の本文に出す固定文言。原因ではなく次に取れる行動だけを伝える
 * (`lib/mutation-error.ts` の `MUTATION_ERROR_FALLBACK_MESSAGE` と対になる意匠)。
 */
export const ROUTE_ERROR_FALLBACK_MESSAGE =
  "ページを表示できませんでした。時間をおいて再試行してください。";

/**
 * route エラー境界の共通表示。再試行は React boundary の reset に加えて
 * router.invalidate() で loader を再実行する (reset だけだと loader / suspense query の
 * エラーが cache に残ったまま再 throw され、即座に同じエラー画面へ戻る)。
 */
export function RouteErrorContent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  // 再実行の結果は loader と error boundary が受けるため待たない
  function handleRetry() {
    reset();
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
              server で描く HTML もここで固定文言にする (ADR-0038)。原因は server のログと、
              ブラウザの console (React が既定で出す) で追う */}
        <p className="text-muted-foreground">
          {exposesServerErrorDetails() ? thrownValueMessage(error) : ROUTE_ERROR_FALLBACK_MESSAGE}
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
