import { isNotFound, type AnyRouteMatch } from "@tanstack/react-router";

import { APP_NAME } from "./app-name";

/** route の `head()` が受ける ctx のうち、`pageTitle` が読む部分 */
export interface PageTitleContext {
  readonly match: Pick<AnyRouteMatch, "status" | "staticData">;
  readonly matches: ReadonlyArray<{ readonly error?: unknown }>;
}

/**
 * ページの `<title>`。遷移の読み上げは `document.title` を読むので、ページごとに違う名前にする
 * (WCAG 2.4.2)。ページ名を先に置き、タブが狭くても区別できるようにする。
 *
 * 名前は自分の route の `staticData.pageName`。読み込んだデータで決まる名前は、その route の `head()` が引数の
 * `pageName` で渡す (ADR-0033)。名前が `APP_NAME` と同じなら重ねない (ホーム)。
 *
 * `ctx.matches` のどれか 1 つでも notFound() を error に持てば not found の title にする。
 * route が投げた `notFound()` では、root の `head()` の `ctx.matches` には not found を受け持つ route (境界) の
 * match まで含まれ、`head()` は境界まで走って深い route の title が勝つ。全 route の `head()` がこの判定を通せば、
 * 境界がどの route でも not found の title になる。どこにも当たらない URL では境界の match が error を持たず、
 * title は境界までの route の `head()` が組んだままになる。router は `notFoundMode: "root"` で root を境界にするので、
 * ページの下の URL もアプリ名になる (ADR-0035「not found の title」)。
 *
 * 自分の match の `status` が `"error"` (route の読み込みの失敗。loader・beforeLoad・component の chunk) なら
 * 前に `エラー: ` を足す (ADR-0035)。
 * 描画中の throw は `head()` の後に起き、`status` を変えないので付かない
 */
export function pageTitle(
  ctx: PageTitleContext,
  pageName: string | undefined = ctx.match.staticData.pageName,
): string {
  if (ctx.matches.some((match) => isNotFound(match.error))) {
    return `ページが見つかりません — ${APP_NAME}`;
  }
  const title =
    pageName === undefined || pageName === APP_NAME ? APP_NAME : `${pageName} — ${APP_NAME}`;
  return ctx.match.status === "error" ? `エラー: ${title}` : title;
}

/** route の `head` が返す値のうち、`pageHead` が組む部分。型は router の `head` の `meta` から取る */
type PageHead = Pick<AnyRouteMatch, "meta">;

function pageHead(ctx: PageTitleContext): PageHead {
  return { meta: [{ title: pageTitle(ctx) }] };
}

/**
 * ページの route の options に spread する `staticData` と `head`。名前を書く場所を `staticData.pageName` の
 * 1 か所にし、title をそこから組む `head` を同じ値で返す (ADR-0035)。`head` を書き忘れると親の route の title になり、
 * 同じ親の下のページと遷移の読み上げで区別できない。router は `head` の既定を持たないので、2 つを 1 組で返す。
 * route のファイルでは呼び出しを options の外で const に受け、その const を spread する。`...pageRouteOptions(x)` と
 * 書くと、`tanstack-router/create-route-property-order` が Identifier でない spread で throw し、lint ごと止まる
 * (TanStack/router#8673)
 */
export function pageRouteOptions(pageName: string): {
  staticData: { pageName: string };
  head: typeof pageHead;
} {
  return { staticData: { pageName }, head: pageHead };
}

/**
 * ページの上に重ねるダイアログの route の options に spread する `staticData` と `head`。`pageName` は title の
 * ページ名になり、`routeDialog` はダイアログの route の印になる (ADR-0035、ADR-0041「閉じる遷移の見せ方」)。
 * `head` を 1 組で返す理由と、const に受けて spread する理由は `pageRouteOptions` と同じ
 */
export function dialogRouteOptions(pageName: string): {
  staticData: { pageName: string; routeDialog: true };
  head: typeof pageHead;
} {
  return { staticData: { pageName, routeDialog: true }, head: pageHead };
}
