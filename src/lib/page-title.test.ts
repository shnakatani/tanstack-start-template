import { notFound, type AnyRouteMatch, type StaticDataRouteOption } from "@tanstack/react-router";
import { expect, it } from "vite-plus/test";

import { APP_NAME } from "./app-name";
import {
  dialogRouteOptions,
  pageRouteOptions,
  pageTitle,
  type PageTitleContext,
} from "./page-title";

/** route の head() が受ける ctx のうち、pageTitle が読む部分を組む */
function headContext({
  staticData = {},
  status = "success",
  errors = [undefined],
}: {
  staticData?: StaticDataRouteOption;
  status?: AnyRouteMatch["status"];
  errors?: unknown[];
} = {}): PageTitleContext {
  return { match: { status, staticData }, matches: errors.map((error) => ({ error })) };
}

it("route の staticData.pageName を、アプリ名と ` — ` でつなぐ", () => {
  expect(pageTitle(headContext({ staticData: { pageName: "項目一覧" } }))).toBe(
    `項目一覧 — ${APP_NAME}`,
  );
});

it("名前がアプリ名と同じなら、アプリ名を重ねない", () => {
  expect(pageTitle(headContext({ staticData: { pageName: APP_NAME } }))).toBe(APP_NAME);
});

it("名前が無ければ、アプリ名だけになる", () => {
  expect(pageTitle(headContext())).toBe(APP_NAME);
});

// 読み込んだデータで決まる名前は staticData に書けないので、route の head() が渡す
it("2 つ目の引数の名前は、staticData.pageName より優先する", () => {
  expect(pageTitle(headContext({ staticData: { pageName: "項目" } }), "項目 1")).toBe(
    `項目 1 — ${APP_NAME}`,
  );
});

// 読み込みに失敗してデータが無いときも、ページの一般の名前の title になる
it("2 つ目の引数が undefined なら、staticData.pageName を使う", () => {
  expect(pageTitle(headContext({ staticData: { pageName: "項目" } }), undefined)).toBe(
    `項目 — ${APP_NAME}`,
  );
});

it("matches のどれかが notFound() を error に持てば、名前があっても not found の title にする", () => {
  const ctx = headContext({
    staticData: { pageName: "項目一覧" },
    errors: [undefined, notFound()],
  });
  expect(pageTitle(ctx)).toBe(`ページが見つかりません — ${APP_NAME}`);
});

it("error が notFound() 以外 (Error) なら not found 扱いしない", () => {
  const ctx = headContext({ staticData: { pageName: "項目一覧" }, errors: [new Error("失敗")] });
  expect(pageTitle(ctx)).toBe(`項目一覧 — ${APP_NAME}`);
});

it("自分の match の status が error (route の読み込みの失敗) なら、前に「エラー: 」を足す", () => {
  const ctx = headContext({
    staticData: { pageName: "項目一覧" },
    status: "error",
    errors: [undefined, new Error("失敗")],
  });
  expect(pageTitle(ctx)).toBe(`エラー: 項目一覧 — ${APP_NAME}`);
});

it("名前の無い route の失敗では、アプリ名の前に「エラー: 」を足す", () => {
  expect(pageTitle(headContext({ status: "error" }))).toBe(`エラー: ${APP_NAME}`);
});

// head が引数の名前を閉じ込めず match の staticData を読むことを見るため、引数と違う名前の match を渡す
it("pageRouteOptions の head は、match の pageName から組んだ title を meta に入れる", () => {
  const { head } = pageRouteOptions("項目一覧");
  expect(head(headContext({ staticData: { pageName: "別のページ" } }))).toEqual({
    meta: [{ title: `別のページ — ${APP_NAME}` }],
  });
});

it("dialogRouteOptions は staticData に routeDialog の印を足し、head は match の pageName から title を組む", () => {
  expect(pageRouteOptions("項目一覧").staticData).toEqual({ pageName: "項目一覧" });
  const dialog = dialogRouteOptions("項目を追加");
  expect(dialog.staticData).toEqual({ pageName: "項目を追加", routeDialog: true });
  expect(
    dialog.head(headContext({ staticData: { pageName: "別のダイアログ", routeDialog: true } })),
  ).toEqual({ meta: [{ title: `別のダイアログ — ${APP_NAME}` }] });
});
