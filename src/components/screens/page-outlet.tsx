import { Outlet } from "@tanstack/react-router";

import { PageHeadingAboveContext } from "@/hooks/page-heading-context";

/**
 * 名前の付いたページ (自分の component が `RoutePageHeader` を描く route) が子の route を描く `<Outlet />`。
 * 子の位置に出る失敗の画面と既定の pending 表示に、ページの h1 が上にあることを context で伝え、名前の行と h1 を
 * 重ねさせない (ADR-0035)。
 *
 * 子の route の境界 (`CatchBoundary`、`CatchNotFound`、Suspense) と、ページ自身の match が `_notFound` のときの
 * not found の画面は、どれも `<Outlet />` の描く木の中にあるので、この context が届く。ページ自身の
 * errorComponent と notFoundComponent はページの component を置き換えて出るので、届かない
 * (`@tanstack/react-router` 1.170.41 の `Match.tsx` の `Outlet` と `MatchView`)
 */
export function PageOutlet() {
  return (
    <PageHeadingAboveContext value>
      <Outlet />
    </PageHeadingAboveContext>
  );
}
