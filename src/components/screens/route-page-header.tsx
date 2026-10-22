import { useMatch } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import { PageHeader } from "@/components/parts/page-header";

/**
 * ページの見出しの行。名前は自分の route の `staticData.pageName` から取り、`<title>` (`pageHead`) と同じ値にする。
 * ページの component と、route の `pendingComponent` が描く。操作 (`actions`) はページの state を持つので、ページが渡す。
 *
 * 名前が無ければ throw する。名前の無いページをアプリ名で描くと、書き忘れが黙って通る。throw は route の
 * errorComponent (pendingComponent の中なら、Suspense の fallback がその route の境界の外にあるので、親の route の
 * errorComponent) が受ける。失敗の画面はこの部品を使わないので、throw は連鎖しない。
 *
 * match からはプリミティブだけを select で読む。match 全体を読むと、loader のデータや取得中の状態が変わるたびに
 * 見出しの行が描き直される
 */
export function RoutePageHeader({ actions }: Pick<ComponentProps<typeof PageHeader>, "actions">) {
  // strict: false の select に渡る match は root の型で、routeId が undefined 型になる (select なしの戻り値では string)。
  // 実行時は string なので String() で型だけを揃える
  const routeId = useMatch({ strict: false, select: (match) => String(match.routeId) });
  const pageName = useMatch({ strict: false, select: (match) => match.staticData.pageName });
  if (pageName === undefined) {
    throw new Error(
      `[RoutePageHeader] route の staticData に pageName が無い (routeId: ${routeId})`,
    );
  }
  return <PageHeader title={pageName} actions={actions} />;
}
