import { expect, it } from "vite-plus/test";

import { APP_NAME } from "./app-name";
import { formatPageTitle } from "./page-title";

it("ページ名とアプリ名を ` — ` でつなぐ", () => {
  expect(formatPageTitle("メモ一覧")).toBe(`メモ一覧 — ${APP_NAME}`);
});
