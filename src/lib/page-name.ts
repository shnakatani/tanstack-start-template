import type { AnyRouteMatch, StaticDataRouteOption } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * ページの名前。`<title>` と、見出しの行の h1 (`RoutePageHeader`、既定の pending と失敗の画面) になる。
     * ページの route (自分の component が `RoutePageHeader` を描く route) と、ページの上に重ねるダイアログの route
     * に、title を組む `head` と 1 組で書く (`pageRouteOptions`、`dialogRouteOptions`)。ページの route は子の route を
     * `<Outlet />` でなく `PageOutlet` で描く。
     * 名前の付いたページの route の子に、ダイアログでない名前の付いたページの route を置かない (h1 が 2 つ並ぶ)。
     * 省略できる key にする。必須にすると root とテストの route まで `staticData` を課す (ADR-0035)
     */
    pageName?: string;
  }
}

/**
 * 見出しの行に出す名前。ダイアログの route の名前は title にだけ使い、背後のページの見出しの行を変えない
 * (ADR-0035、ADR-0041)
 */
export function pageHeadingNameOf(staticData: StaticDataRouteOption): string | undefined {
  return staticData.routeDialog === true ? undefined : staticData.pageName;
}

export type RouteFailureKind = "error" | "notFound";

export interface FailureScreenLayout {
  /** 失敗の画面が自分で描く見出しの行の名前。ページの見出しの行が上に残るか、名前の付いたページが無ければ undefined */
  headingRowName: string | undefined;
  /** 失敗の見出しの level。ページの名前の見出しの行 (h1) が画面にあれば 2、無ければ 1 */
  failureHeadingLevel: 1 | 2;
}

type PageNameMatch = Pick<AnyRouteMatch, "id" | "status" | "staticData">;

/**
 * 失敗の画面 (`ownMatchId` の match の route の errorComponent か notFoundComponent) の見出しの形を決める。
 * - `underPageHeading` が true: 名前の付いたページの `PageOutlet` の中に出た画面で、ページの見出しの行が上に残る。
 *   見出しの行を描かず、失敗の見出しを h2 にする
 * - false: ページの見出しの行は画面に無い。名前の範囲で最も深い名前 (ダイアログの route を飛ばす) を N とし、
 *   N があれば N の見出しの行を描いて失敗の見出しを h2 に、無ければ見出しの行を描かずに h1 にする
 *
 * 名前の範囲は、自分の match の状態で決める。
 * - error の画面と、自分の match が `status: "notFound"` の not found の画面: 最初の success でない match (境界)
 *   まで、無ければ全部 (描画中の throw)。error を祖先の errorComponent が受けると、自分の match と失敗したページが
 *   別になるので、自分の match だけでは足りない
 * - 自分の match が success の not found の画面: 自分の match まで。自分の `<Outlet />` の中の not found と、描画中の
 *   `notFound()` を自分の notFoundComponent が受けた画面がこれに当たる
 *
 * ページの見出しの行が上にあるかは引数で受け、matches から推し量らない。上の 2 つの not found は同じ matches になり、
 * `<Outlet />` だけを描くレイアウトは `pageName` を持っても h1 を描かない。分けられるのは、失敗の画面が React の木の
 * どこに描かれたか (`PageOutlet` の context) だけである (ADR-0035)
 */
export function failureScreenLayout(
  matches: ReadonlyArray<PageNameMatch>,
  ownMatchId: string,
  kind: RouteFailureKind,
  underPageHeading: boolean,
): FailureScreenLayout {
  // matches を読まずに決まる。自分の match が matches に無くても、ページの見出しの行が上にあることは変わらない
  if (underPageHeading) {
    return { headingRowName: undefined, failureHeadingLevel: 2 };
  }
  const ownIndex = matches.findIndex((match) => match.id === ownMatchId);
  const own = matches[ownIndex];
  if (own === undefined) {
    // 部品の木と router の状態が食い違っている。失敗の画面ごと壊さず、名前の無い形で描く
    console.warn("[failureScreenLayout] 自分の match の id が matches に無い", {
      ownMatchId,
      matchIds: matches.map((match) => match.id),
    });
    return { headingRowName: undefined, failureHeadingLevel: 1 };
  }
  const range = readsUpToBoundary(own, kind)
    ? matchesUpToBoundary(matches)
    : matches.slice(0, ownIndex + 1);
  const name = range.map((match) => pageHeadingNameOf(match.staticData)).findLast(isDefined);
  return { headingRowName: name, failureHeadingLevel: name === undefined ? 1 : 2 };
}

function isDefined(name: string | undefined): name is string {
  return name !== undefined;
}

/** 名前の範囲を境界まで取るか (error の画面と、自分の match が `status: "notFound"` の not found の画面) */
function readsUpToBoundary(own: PageNameMatch, kind: RouteFailureKind): boolean {
  switch (kind) {
    case "error":
      return true;
    case "notFound":
      return own.status === "notFound";
    default: {
      const unhandled: never = kind;
      throw new Error(`unhandled route failure kind: ${String(unhandled)}`);
    }
  }
}

/** 最初の success でない match (失敗か not found の境界) までの match。無ければ全部 */
function matchesUpToBoundary(matches: ReadonlyArray<PageNameMatch>): ReadonlyArray<PageNameMatch> {
  const boundaryIndex = matches.findIndex((match) => match.status !== "success");
  return boundaryIndex === -1 ? matches : matches.slice(0, boundaryIndex + 1);
}
