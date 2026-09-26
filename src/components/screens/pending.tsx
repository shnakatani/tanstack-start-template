import { Spinner } from "@/components/ui/spinner";

/**
 * router の既定 pending 表示 (`defaultPendingComponent`)。route が `pendingComponent` を持たない
 * ときの Suspense の受け皿になる (ADR-0029)。置かれる位置 (ページ全体 / Outlet の内側) が route
 * ごとに違うので、レイアウトを模倣しない。
 *
 * status は name from author のロールなので、可視テキストがあっても `aria-label` で名前を与える。
 * route の pending 表示は、状態を `announce()` で通知する規範の例外 (ADR-0026、ADR-0029)。
 */
export function PendingContent() {
  return (
    <output
      aria-label="読み込み中"
      aria-busy="true"
      className="flex items-center justify-center gap-2 p-6 text-muted-foreground"
    >
      <Spinner aria-hidden />
      読み込み中
    </output>
  );
}
