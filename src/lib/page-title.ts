import { isNotFound } from "@tanstack/react-router";

import { APP_NAME } from "./app-name";

/**
 * ページの `<title>`。遷移の読み上げは `document.title` を読むので、ページごとに違う名前にする
 * (WCAG 2.4.2)。ページ名を先に置き、タブが狭くても区別できるようにする。
 *
 * `ctx.matches` のどれか 1 つでも notFound() を error に持てば not found の title にする。
 * root の `head()` の `ctx.matches` には not found を受け持つ route (境界) の match まで含まれ、
 * `head()` は境界まで走って深い route の title が勝つ。全 route の `head()` がこの判定を通せば、
 * 境界がどの route でも not found の title になる。
 */
export function pageTitle(
  ctx: { matches: ReadonlyArray<{ error?: unknown }> },
  pageName?: string,
): string {
  if (ctx.matches.some((match) => isNotFound(match.error))) {
    return `ページが見つかりません — ${APP_NAME}`;
  }
  if (pageName === undefined) {
    return APP_NAME;
  }
  return `${pageName} — ${APP_NAME}`;
}
