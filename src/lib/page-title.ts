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
 * 名前は自分の route の `staticData.pageName`。読み込んだデータで決まる名前は `pageName` で渡す (ADR-0033)。
 * 名前が `APP_NAME` と同じなら重ねない (ホーム)。
 *
 * `ctx.matches` のどれか 1 つでも notFound() を error に持てば not found の title にする。
 * root の `head()` の `ctx.matches` には not found を受け持つ route (境界) の match まで含まれ、
 * `head()` は境界まで走って深い route の title が勝つ。全 route の `head()` がこの判定を通せば、
 * 境界がどの route でも not found の title になる。
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

/**
 * route の `head` にそのまま渡す。名前を書く場所を `staticData.pageName` の 1 か所にする (ADR-0035)。
 * 書き忘れると、親の route の title になる
 */
export function pageHead(ctx: PageTitleContext) {
  return { meta: [{ title: pageTitle(ctx) }] };
}
