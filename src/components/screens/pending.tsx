import { useMatch } from "@tanstack/react-router";

import { PageHeader } from "@/components/parts/page-header";
import { Spinner } from "@/components/ui/spinner";
import { pageHeadingNameOf } from "@/lib/page-name";

/**
 * router の既定 pending 表示 (`defaultPendingComponent`)。route が `pendingComponent` を持たない
 * ときの Suspense の受け皿になる (ADR-0029)。置かれる位置 (ページ全体 / Outlet の内側) が route
 * ごとに違うので、レイアウトを模倣しない。名前の付いたページの route (ダイアログの route でない) では、
 * 前に名前だけの見出しの行を置く。操作はページの state を持つので描かない。
 *
 * status に名前は与えない。一部のスクリーンリーダーは status の名前を中身の前に読むので、中身と同じ
 * 名前を与えると同じ文言を 2 度読ませる (`docs/guides/accessibility.md`「accessible name を与える」)。
 * route の pending 表示は、状態を `announce()` で通知する規範の例外 (ADR-0026、ADR-0029)。
 * `aria-busy` は載せない (`docs/guides/accessibility.md`「読み込み中の表示を組む」)。
 */
export function PendingContent() {
  // 自分の match は、この表示を fallback に持つ読み込み中の route。root の <Outlet /> の fallback では root になり、
  // root は名前を持たないので行を描かない。router のいちばん外の Suspense の fallback (CSR とテストで張られ、どの
  // match の中にも無い位置) では match が無いので、throw させずに undefined (名前なし) として扱う
  const headingName = useMatch({
    strict: false,
    shouldThrow: false,
    select: (match) => pageHeadingNameOf(match.staticData),
  });
  return (
    <>
      {headingName === undefined ? null : <PageHeader title={headingName} />}
      <output className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
        <Spinner aria-hidden />
        読み込み中
      </output>
    </>
  );
}
