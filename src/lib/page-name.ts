import type { AnyRouteMatch, StaticDataRouteOption } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * ページの名前。`<title>` (`pageHead`) と、見出しの行の h1 (`RoutePageHeader`、既定の pending と失敗の画面) になる。
     * ページの route と、ページの上に重ねるダイアログの route に書き、root と pathless layout には書かない。
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
  /** 失敗の見出しの level。名前の付いたページの見出し (h1) が画面にあれば 2、無ければ 1 */
  failureHeadingLevel: 1 | 2;
}

// AnyRouteMatch の routeId は any なので、string に絞って unsafe な any を持ち込まない
type PageNameMatch = Pick<AnyRouteMatch, "status" | "staticData"> & { routeId: string };

/**
 * 失敗の画面 (`ownRouteId` の route の errorComponent か notFoundComponent) の見出しの形を決める。
 * - 置き換え: error の画面と、自分の match が `status: "notFound"` の not found の画面。自分の route の component を
 *   置き換えて出る。名前は最初の success でない match (境界) まで、無ければ全部 (描画中の throw) から選ぶ
 * - Outlet の中: 自分の match が success の not found の画面。自分の route の component は描かれたままで、その
 *   `<Outlet />` の位置に出る。名前は自分の match までから選ぶ
 * その範囲で最も深い名前 (ダイアログの route を飛ばす) を N とする。見出しの行は、置き換えで N が自分の match 以深の
 * ときだけ描く (N の component が消えているため)。level は N があれば 2、無ければ 1。
 * 自分の match だけでは足りない。error を祖先の errorComponent が受けると、自分の match と失敗したページが別になる。
 *
 * 扱わない場面: 描画中に投げた `notFound()` を自分の route の notFoundComponent が受けると、component は置き換わるが
 * match の `status` は success のままで、公開の状態からは Outlet の中の not found と分けられない。名前の付いたページ
 * では見出しの行が描かれず、h1 が無くなる。`notFound()` は loader か beforeLoad で投げる (ADR-0035)
 */
export function failureScreenLayout(
  matches: ReadonlyArray<PageNameMatch>,
  ownRouteId: string,
  kind: RouteFailureKind,
): FailureScreenLayout {
  const ownIndex = matches.findIndex((match) => match.routeId === ownRouteId);
  const own = matches[ownIndex];
  if (own === undefined) {
    // 部品の木と router の状態が食い違っている。失敗の画面ごと壊さず、名前の無い形で描く
    console.warn("[failureScreenLayout] 自分の routeId が matches に無い", {
      ownRouteId,
      routeIds: matches.map((match) => match.routeId),
    });
    return { headingRowName: undefined, failureHeadingLevel: 1 };
  }
  const replaces = replacesOwnComponent(own, kind);
  const range = replaces ? matchesUpToBoundary(matches) : matches.slice(0, ownIndex + 1);
  const names = range.map((match) => pageHeadingNameOf(match.staticData));
  const namedIndex = names.findLastIndex((name) => name !== undefined);
  const name = names[namedIndex];
  if (name === undefined) {
    return { headingRowName: undefined, failureHeadingLevel: 1 };
  }
  return {
    headingRowName: replaces && namedIndex >= ownIndex ? name : undefined,
    failureHeadingLevel: 2,
  };
}

function replacesOwnComponent(own: PageNameMatch, kind: RouteFailureKind): boolean {
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
