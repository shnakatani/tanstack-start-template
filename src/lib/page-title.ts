import { APP_NAME } from "./app-name";

/**
 * ページの `<title>`。遷移の読み上げは `document.title` を読むので、ページごとに違う名前にする
 * (WCAG 2.4.2)。ページ名を先に置き、タブが狭くても区別できるようにする。
 */
export function formatPageTitle(pageName: string): string {
  return `${pageName} — ${APP_NAME}`;
}
