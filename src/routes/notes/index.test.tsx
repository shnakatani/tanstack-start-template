import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { RouteErrorContent } from "@/components/screens/route-error";
import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";
import { createTestRouter } from "@/test/create-test-router";
import { readAnnouncements } from "@/test/live-announcer";
import { createTestQueryClient } from "@/test/page-helpers";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/features/notes/functions", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { listNotes } = await import("@/features/notes/functions");

// この画面に固有のテストの書き方 (route 全般の書き方は ADR-0046、debounce の打ち方と fake timers を
// 使わない理由は `docs/guides/testing.md`「debounce のある入力をテストする」):
// - 検索欄の landmark は `<search>` 要素で、部品のテストは要素名で見る。同梱の locator engine が
//   `search` role を `<search>` に写さない (2026-09-23 に実測)。`<form role="search">` にして
//   `getByRole("search")` で引く形は採らない。本番のマークアップをテストの欠落に合わせない
// - 同じ画面で `q` が別の値へ変わる経路は `router.navigate` で作る。確定は replace なので、memory history の
//   `back()` では前の `q` に戻れない
//
// debounce の待ちを広げる (理由は -components/notes-page.test.tsx の同じ vi.mock)。確定と戻るの直後は
// 編集の世代が URL と合わず debounce 済みの値を使わないので、広げても Enter と戻るの通知は即座に出る
vi.mock(import("./-lib/note-search"), async (importOriginal) => ({
  ...(await importOriginal()),
  NOTE_SEARCH_DEBOUNCE_MS: 1_500,
}));

import { noteSearchbox } from "./-components/note-search-field.test-helpers";
import { noteColumns } from "./-lib/note-columns";
import { Route } from "./index";

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と
 * `<html>` を描くので browser test では使えない (ADR-0046)。root は本番と同じ context 型を持ち、
 * `Route` は生成コードと同じ `update({ id, path, getParentRoute })` で付ける。
 */
const testRootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
});

// `update` の公開型は id / path / getParentRoute を持たない (生成コードは `as any` で渡す)。
// 型アサーションを書かずに済むよう、交差型で注釈した変数を渡す
const attachment: Parameters<typeof Route.update>[0] & {
  id: string;
  path: string;
  getParentRoute: () => typeof testRootRoute;
} = { id: "/notes/", path: "/notes/", getParentRoute: () => testRootRoute };

const routeTree = testRootRoute.addChildren([Route.update(attachment)]);

/**
 * wrapper (`Route.useSearch` / `Route.useNavigate`) を実 router で動かし、URL → props と
 * 操作 → URL の往復を見る (TanStack Router how-to「Test Router with File-Based Routing」の形を
 * memory history で)。props 直渡しの page テスト (-components/notes-page.test.tsx) では wrapper が一度も実行されない
 */
async function renderRoute(initialLocation: string) {
  const queryClient = createTestQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    // search の検証失敗を route の境界で受けることを、本番 (`src/router.tsx`) と同じ部品を渡して見る
    // (既定値の同一性は測らない)。無いと root の外まで抜けて組み込みの ErrorComponent が描き、
    // "wasn't caught by any route" の warn が出る (2026-09-23 に実測)
    defaultErrorComponent: RouteErrorContent,
  });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, router };
}

/**
 * route の定義と、wrapper (Route hooks と通知) の実 router での往復。
 * ページ本体の描画は -components/notes-page.test.tsx が持つ
 */
describe("/notes route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listNotes).mockResolvedValue([]);
  });

  it("route に loader が定義され、pendingComponent で skeleton が表示される", async () => {
    expect(typeof Route.options.loader).toBe("function");

    const Pending = Route.options.pendingComponent!;
    const router = createTestRouter("/notes", () => <Pending />);
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
    // skeleton の列数は列定義から採る。ずれるとロード完了時にレイアウトシフトが出る (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
    await expect.element(screen.getByRole("columnheader")).toHaveLength(noteColumns.length);
  });

  it("URL の q が loader と入力欄に届く", async () => {
    const { screen } = await renderRoute("/notes?q=abc");

    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // loader が温めた key を component が読むので 1 回。loaderDeps が無いと空の deps の取得が先に走る
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: "abc" } });
    // 初期表示は結果の入れ替わりではないので通知しない (region が無ければ throw する helper)
    expect(readAnnouncements()).toEqual([]);
  });

  it("入力して Enter すると URL の q が確定する", async () => {
    const { screen, router } = await renderRoute("/notes");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.search).toEqual({ q: "xyz" });
    expect(router.state.location.href).toBe("/notes?q=xyz");
    // 検索は同じ画面の絞り込みなので履歴を積まない (replace)。push に変わると 2 になる
    expect(router.history.length).toBe(1);
    // 確定後の結果を通知する (debounce が明ける前の Enter でも落とさない。ADR-0035)
    await vi.waitFor(() => {
      expect(readAnnouncements()).toEqual(["『xyz』に一致するメモは 0 件です"]);
    });
    // 入力欄は作り直されず、フォーカスが残る (key={q} でページを作り直すと body へ落ちる)
    await expect.element(noteSearchbox(screen)).toHaveFocus();
  });

  it("確定した後に URL の q が元の値へ戻っても、確定済みの編集は復活せず入力欄も一覧も q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");

    // 途中入力を挟まずに、別の遷移 (Link や他画面からの戻る) で同じ値へ。編集を URL の値で紐付けると、
    // 同じ値に戻った瞬間に確定済みの編集が復活する
    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    await vi.waitFor(() => {
      expect(readAnnouncements()).toEqual([
        "『xyz』に一致するメモは 0 件です",
        "『abc』に一致するメモは 0 件です",
      ]);
    });
  });

  it("別の遷移で URL の q が変わると、入力欄の途中入力を捨ててその q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    await noteSearchbox(screen).fill("typed");

    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // 遷移で入れ替わった結果も通知する。同じ条件へ戻っても、直前に通知した条件と違えば出す
    await vi.waitFor(() => {
      expect(readAnnouncements()).toEqual([
        "『xyz』に一致するメモは 0 件です",
        "『abc』に一致するメモは 0 件です",
      ]);
    });
  });

  it("空白だけで Enter すると q は URL に残らない", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");

    await noteSearchbox(screen).fill("   ");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe("/notes");
  });

  it("上限を超える q は切り詰めて描き、エラーにしない (Router の search-params ガイドの fallback)", async () => {
    const capped = "a".repeat(NOTE_QUERY_MAX_LENGTH);
    const { screen } = await renderRoute(`/notes?q=${capped}a`);

    await expect.element(noteSearchbox(screen)).toHaveValue(capped);
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: capped } });
  });

  it("文字列以外の q (JSON パースで number になる) は route の error component に落ちる", async () => {
    const { screen } = await renderRoute("/notes?q=123");

    // Router は Standard Schema の issues を JSON にして SearchParamError を投げ、RouteErrorContent が
    // DEV では error.message をそのまま出す。schema の文言が含まれることを見る
    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("検索語は文字列で指定してください", { exact: false }))
      .toBeInTheDocument();
    expect(vi.mocked(listNotes)).not.toHaveBeenCalled();
  });
});
