import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {/* 本文がエラーメッセージとスタックトレースで左寄せのため、見出しも中央寄せにしない */}
        <CardHeader>
          {/* 見出し階層は利用側の裁量 (full-screen-card.tsx の CardTitle 合成の説明を参照)。
              registry の CardTitle は text-base / font-medium で、カード内の小見出しの寸法。
              ここはページ全体の見出しなので FullScreenNotice と同じ text-lg / font-semibold へ
              揃える (2 つの全画面エラー表示で見出しの大きさが揃わないのを防ぐ) */}
          <CardTitle className="text-lg font-semibold text-destructive">
            <h1>エラーが発生しました</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* error.message は server function の throw 文言をそのまま運ぶ開発者向けの情報なので、
              スタックトレースと同じく DEV でだけ出す。production で raw error を追う経路は
              React の error boundary が console へ残すログが担う */}
          <p className="text-muted-foreground">
            {import.meta.env.DEV ? error.message : ROUTE_ERROR_FALLBACK_MESSAGE}
          </p>
          {import.meta.env.DEV && error.stack && (
            <Accordion>
              <AccordionItem value="stack-trace">
                <AccordionTrigger className="text-muted-foreground">
                  スタックトレース
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea
                    className="rounded bg-muted"
                    viewportClassName="max-h-48 data-has-overflow-x:pb-2.5 data-has-overflow-y:pr-2.5"
                  >
                    <pre className="p-3 text-xs">{error.stack}</pre>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          <Button onClick={handleRetry} className="self-start">
            再試行
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * route 境界より上 (root) で落ちたエラーの全画面表示。document ごと差し替わるので、
 * route 側の `defaultErrorComponent` と違い背景から画面いっぱいに組む。
 *
 * 枠を持つのはこのファイルの責務にする。消費側 (`routes/__root.tsx`) が中央寄せの
 * class を持つと、枠と中身が別ファイルに分かれて片方だけの変更で崩れる。
 *
 * 高さは `h-screen` ではなく `min-h-svh` で取る (`full-screen-card.tsx` と同じ理由)。
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
