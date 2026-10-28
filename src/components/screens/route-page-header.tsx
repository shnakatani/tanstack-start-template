import { useMatch } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import { PageHeader } from "@/components/parts/page-header";

/**
 * ページの見出しの行。名前は自分の route の `staticData.pageName` から取り、`<title>` (`pageRouteOptions` の `head`) と同じ値にする。
 * ページの component と、route の `pendingComponent` が描く。操作 (`actions`) はページの state を持つので、ページが渡す。
 *
 * 名前が無ければ throw する。名前の無いページをアプリ名で描くと、書き忘れが黙って通る。ページの component の中の
 * throw は、その route の errorComponent が受ける。pendingComponent の中の throw は、描かれた経路で受ける route が
 * 変わる。route の Suspense の fallback として描かれたときは、fallback がその route の境界の外にあるので親の route の
 * errorComponent が、読み込み中の match を描く `MatchInner` が直接描いたときは、その route の errorComponent が受ける
 * (`@tanstack/react-router` の `Match.tsx` の `MatchView` と `MatchInner`)。ページの位置で受けるエラーの画面
 * (`PageRouteError`) もこの部品を描く。そこでの throw はその route の境界の外なので、祖先 (無ければ root) の
 * errorComponent が受ける。
 *
 * match からはプリミティブだけを select で読む。match 全体を読むと、loader のデータや取得中の状態が変わるたびに
 * 見出しの行が描き直される
 */
export function RoutePageHeader({ actions }: Pick<ComponentProps<typeof PageHeader>, "actions">) {
  const matchId = useMatch({ strict: false, select: (match) => match.id });
  const pageName = useMatch({ strict: false, select: (match) => match.staticData.pageName });
  if (pageName === undefined) {
    throw new Error(
      `[RoutePageHeader] route の staticData に pageName が無い (match の id: ${matchId})`,
    );
  }
  return <PageHeader title={pageName} actions={actions} />;
}
