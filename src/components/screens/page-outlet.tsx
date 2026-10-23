import { Outlet } from "@tanstack/react-router";

import { PageHeadingAboveContext } from "@/hooks/page-heading-context";

/**
 * `<h1>` を描くページ (自分の component が `RoutePageHeader` か、読み込んだ名前を渡した `PageHeader` を描く route)
 * が子の route を描く `<Outlet />`。
 * 子の位置に出る失敗の画面と既定の pending 表示に、ページの h1 が上にあることを context で伝え、名前の行と h1 を
 * 重ねさせない (ADR-0035)。
 *
 * 子の route の境界 (`CatchBoundary`、`CatchNotFound`、Suspense) と、ページ自身の match が `_notFound` のときに
 * `<Outlet />` が描くページ自身の notFoundComponent は、どれも `<Outlet />` の描く木の中にあるので、この context が
 * 届く。ページ自身の errorComponent と、`status: "notFound"` か描画中の `notFound()` (`CatchNotFound` の fallback)
 * で出るページ自身の notFoundComponent は、ページの component を置き換えて出るので、届かない
 * (`@tanstack/react-router` 1.170.41 の `Match.tsx` の `Outlet`、`MatchView`、`MatchInner`)。
 *
 * TanStack Router の `Outlet` は子の木へ値を渡す口 (React Router の `<Outlet context>` にあたるもの) を持たないので、
 * 自前の context provider で包む (ADR-0035「失敗の画面の見出しと focus」)
 */
export function PageOutlet() {
  return (
    <PageHeadingAboveContext value>
      <Outlet />
    </PageHeadingAboveContext>
  );
}
