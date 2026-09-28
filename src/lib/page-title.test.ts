import { notFound } from "@tanstack/react-router";
import { expect, it } from "vite-plus/test";

import { APP_NAME } from "./app-name";
import { pageTitle } from "./page-title";

it("ページ名を渡すと、アプリ名と ` — ` でつなぐ", () => {
  expect(pageTitle({ matches: [{ error: undefined }] }, "メモ一覧")).toBe(`メモ一覧 — ${APP_NAME}`);
});

it("ページ名を渡さないと、アプリ名だけになる", () => {
  expect(pageTitle({ matches: [{ error: undefined }] })).toBe(APP_NAME);
});

it("matches のどれかが notFound() を error に持てば、ページ名を渡しても not found の title にする", () => {
  const matches = [{ error: undefined }, { error: notFound() }];
  expect(pageTitle({ matches }, "メモ一覧")).toBe(`ページが見つかりません — ${APP_NAME}`);
});

it("error が notFound() 以外 (Error) なら not found 扱いしない", () => {
  const matches = [{ error: new Error("失敗") }];
  expect(pageTitle({ matches }, "メモ一覧")).toBe(`メモ一覧 — ${APP_NAME}`);
});
