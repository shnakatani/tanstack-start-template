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
import { createTestQueryClient } from "@/test/page-helpers";

import { NOTE_SEARCH_LABEL } from "./-lib/note-search";
import { Route } from "./index";

// server functions は実 DB を掴むので、ブラウザテストからは呼ばせない (index.test.tsx と同じ)
vi.mock("@/features/notes/functions", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { listNotes } = await import("@/features/notes/functions");

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と
 * `<html>` を描くので browser test では使えない (ADR-0033)。root は本番と同じ context 型を持ち、
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
 * memory history で)。props 直渡しの page テスト (index.test.tsx) では wrapper が一度も実行されない
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

function searchbox(screen: Awaited<ReturnType<typeof renderRoute>>["screen"]) {
  return screen.getByRole("searchbox", { name: NOTE_SEARCH_LABEL });
}

describe("/notes の search param", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listNotes).mockResolvedValue([]);
  });

  it("URL の q が loader と入力欄に届く", async () => {
    const { screen } = await renderRoute("/notes?q=abc");

    await expect.element(searchbox(screen)).toHaveValue("abc");
    // loader が温めた key を component が読むので 1 回。loaderDeps が無いと空の deps の取得が先に走る
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: "abc" } });
  });

  it("入力して Enter すると URL の q が確定する", async () => {
    const { screen, router } = await renderRoute("/notes");

    await searchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.search).toEqual({ q: "xyz" });
    expect(router.state.location.href).toBe("/notes?q=xyz");
    // 明示操作 1 回につき履歴 1 つ (push)。戻るで絞り込み前の一覧に戻れる
    expect(router.history.length).toBe(2);
  });

  it("戻るで URL の q が変わると、入力欄の途中入力を捨ててその q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(searchbox(screen)).toHaveValue("abc");

    await searchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    await searchbox(screen).fill("typed");

    router.history.back();

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(searchbox(screen)).toHaveValue("abc");
  });

  it("空白だけで Enter すると q は URL に残らない", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");

    await searchbox(screen).fill("   ");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe("/notes");
  });

  it("空にして Enter すると q が URL から消える", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");

    await searchbox(screen).fill("");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe("/notes");
  });

  it("上限を超える q は route の error component に落ちる", async () => {
    const { screen } = await renderRoute(`/notes?q=${"a".repeat(NOTE_QUERY_MAX_LENGTH + 1)}`);

    // Router は Standard Schema の issues を JSON にして SearchParamError を投げ、RouteErrorContent が
    // DEV では error.message をそのまま出す。schema の文言が含まれることを見る
    await expect
      .element(screen.getByRole("heading", { name: "エラーが発生しました" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(`検索語は ${NOTE_QUERY_MAX_LENGTH} 文字以内で入力してください`, {
          exact: false,
        }),
      )
      .toBeInTheDocument();
    expect(vi.mocked(listNotes)).not.toHaveBeenCalled();
  });
});
