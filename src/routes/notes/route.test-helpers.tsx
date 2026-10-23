import { QueryCache, QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { RouteErrorContent } from "@/components/screens/route-error";
import { toast, Toaster } from "@/components/ui/toast";
import { getNote, listNotes } from "@/features/notes/functions";
import type { Note } from "@/features/notes/schema";
import { createBackgroundRefetchErrorHandler } from "@/lib/query-cache-handlers";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { createTestQueryClient } from "@/test/app/query-client";
import type { Screen } from "@/test/assert/screen-assertions";

import { Route as NoteEditRoute } from "./$noteId.edit";
import { NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";
import { Route as NoteCreateRoute } from "./new";
import { Route as NotesRoute } from "./route";

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と
 * `<html>` を描くので browser test では使えない (docs/guides/testing/real-router.md「route の wrapper をテストする」)。root は本番と同じ context 型を持ち、
 * 一覧と追加と編集の `Route` は生成コードと同じ `update({ id, path, getParentRoute })` で付ける。
 * `HeadContent` は本番の root と同じく、route の `head()` の title を `document.title` へ反映させるために置く。
 * `Toaster` は本番の root と同じく、保存の失敗の toast を描くために置く。
 */
const testRootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <Toaster />
    </>
  ),
});

// `update` の公開型は id / path / getParentRoute を持たない (生成コードは `as any` で渡す)。
// 型アサーションを書かずに済むよう、交差型で注釈した変数を渡す
const notesAttachment: Parameters<typeof NotesRoute.update>[0] & {
  id: string;
  path: string;
  getParentRoute: () => typeof testRootRoute;
} = { id: "/notes", path: "/notes", getParentRoute: () => testRootRoute };
const notesRoute = NotesRoute.update(notesAttachment);

const editAttachment: Parameters<typeof NoteEditRoute.update>[0] & {
  id: string;
  path: string;
  getParentRoute: () => typeof notesRoute;
} = { id: "/$noteId/edit", path: "/$noteId/edit", getParentRoute: () => notesRoute };

const createAttachment: Parameters<typeof NoteCreateRoute.update>[0] & {
  id: string;
  path: string;
  getParentRoute: () => typeof notesRoute;
} = { id: "/new", path: "/new", getParentRoute: () => notesRoute };

const routeTree = testRootRoute.addChildren([
  notesRoute.addChildren([
    NoteCreateRoute.update(createAttachment),
    NoteEditRoute.update(editAttachment),
  ]),
]);

/**
 * wrapper (`Route.useSearch` / `Route.useNavigate`) を実 router で動かし、URL → props と
 * 操作 → URL の往復を見る (TanStack Router how-to「Test Router with File-Based Routing」の形を
 * memory history で)。props 直渡しの page テスト (-components/notes-page.test.tsx) では wrapper が一度も実行されない
 */
export async function renderRoute(
  initialLocation: string,
  { pendingMs }: { pendingMs?: number } = {},
) {
  // 本番 (`src/router.tsx`) と同じ配線を通し、取り直しの失敗の toast が出るかをテストで見られるようにする
  const queryClient = createTestQueryClient({
    queryCache: new QueryCache({
      onError: createBackgroundRefetchErrorHandler((message) =>
        toast.add({ type: "error", title: message, id: "background-refetch-error" }),
      ),
    }),
  });
  const router = createRouterWithTestDefaults({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    // 本番 (`src/router.tsx`) と同じ配線を通す。遷移の読み上げと focus の移動 (ADR-0035) が、ダイアログを
    // 閉じたあとの focus と通知に加わる
    InnerWrap: RouterInnerWrap,
    // search の検証失敗を route の境界で受けることを、本番 (`src/router.tsx`) と同じ部品を渡して見る
    // (既定値の同一性は測らない)。無いと root の外まで抜けて組み込みの ErrorComponent が描き、
    // "wasn't caught by any route" の warn が出る (2026-09-23 に実測)
    defaultErrorComponent: RouteErrorContent,
    // undefined を渡すと Router の既定 (1000ms) を上書きするので、指定したときだけ渡す
    ...(pendingMs === undefined ? {} : { defaultPendingMs: pendingMs }),
  });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, router };
}

/**
 * 一覧と、その各行の getNote の応答を張る。getNote は登録した id でだけ応答する (vi.when)。
 * 戻り値に `toHaveBeenExhausted()` を当て、開いた行の取得が走ったことを閉じる
 */
export function serveNotes(notes: Note[]) {
  vi.mocked(listNotes).mockResolvedValue(notes);
  const fetching = vi.when(vi.mocked(getNote), { onUnmatched: "throw" });
  for (const note of notes) {
    fetching.calledWith({ data: { id: note.id } }).thenResolve(note);
  }
  return fetching;
}

/**
 * `recordFocusins` (`@/test/assert/focusin`) で記録した要素の aria-label。行の編集リンクは
 * モーダルの背後で aria-hidden になり locator で引けないので、名前を持つ aria-label の値
 * (`noteEditTriggerName`) で見分ける
 */
export function ariaLabelsOf(targets: Element[]): (string | null)[] {
  return targets.map((target) => target.getAttribute("aria-label"));
}

/**
 * ダイアログの route を開いた画面で、ページの見出しが一覧の名前の h1 1 つのまま残ること。モーダルのダイアログが
 * 外側を aria-hidden で隠すので、includeHidden で引く
 */
export const expectNotesHeadingBehindDialog = vi.defineHelper(async (screen: Screen) => {
  await expect
    .element(screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1, includeHidden: true }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("heading", { level: 1, includeHidden: true }))
    .toHaveLength(1);
});
