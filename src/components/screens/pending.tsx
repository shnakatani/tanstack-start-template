import { Spinner } from "@/components/ui/spinner";

/**
 * router の既定 pending 表示 (`defaultPendingComponent`)。route が `pendingComponent` を持たない
 * ときの Suspense の受け皿になる (ADR-0029)。置かれる位置 (ページ全体 / Outlet の内側) が route
 * ごとに違うので、レイアウトを模倣しない。
 *
 * route の pending 表示は、状態を `announce()` で通知する規範の例外 (ADR-0026、ADR-0029)。
 * `aria-busy` は載せない (`docs/guides/accessibility.md`「読み込み中の表示を組む」)。名前は与えない。
 * 一部のスクリーンリーダーは status の名前を中身の前に読むので、中身と同じ名前を与えると同じ文言を 2 度読ませる
 * (`docs/guides/accessibility.md`「accessible name を与える」)。
 */
export function PendingContent() {
  return (
    <output className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
      <Spinner aria-hidden />
      読み込み中
    </output>
  );
}
