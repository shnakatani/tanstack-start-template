import { QueryCache, QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { onTestFinished, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { RouteErrorContent } from "@/components/screens/route-error";
import { toast, Toaster } from "@/components/ui/toast";
import { getNote, listNotes } from "@/features/notes/functions";
import type { Note } from "@/features/notes/schema";
import { createBackgroundRefetchErrorHandler } from "@/lib/query-cache-handlers";
import { createTestQueryClient } from "@/test/app/query-client";
import { enableAnimations } from "@/test/browser/animations";

import { Route as NoteEditRoute } from "./$noteId.edit";
import { Route as NoteCreateRoute } from "./new";
import { Route as NotesRoute } from "./route";

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と
 * `<html>` を描くので browser test では使えない (docs/guides/testing/route-wrappers.md「route の wrapper をテストする」)。root は本番と同じ context 型を持ち、
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
  const router = createRouter({
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
    // pending 表示の最小表示時間 (既定 500ms) を打ち消す (src/test/app/create-test-router.tsx と同じ)
    defaultPendingMinMs: 0,
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
 * これから focusin を受けた要素を順に記録する。1 frame だけ focus が通った要素は、`toHaveFocus` の
 * retry の間隔では捉えられない
 */
export function recordFocusins(): Element[] {
  const targets: Element[] = [];
  const record = (event: FocusEvent) => {
    if (event.target instanceof Element) {
      targets.push(event.target);
    }
  };
  document.addEventListener("focusin", record);
  onTestFinished(() => document.removeEventListener("focusin", record));
  return targets;
}

/**
 * 記録した要素の aria-label。行の編集リンクはモーダルの背後で aria-hidden になり locator で引けないので、
 * 名前を持つ aria-label の値 (`noteEditTriggerName`) で見分ける
 */
export function ariaLabelsOf(targets: Element[]): (string | null)[] {
  return targets.map((target) => target.getAttribute("aria-label"));
}

/** 閉じかけのダイアログの本体。閉じるアニメーションを遅らせる style と、それが効いたかを見る observer が共有する */
const CLOSING_DIALOG_SELECTOR = "[data-slot=dialog-content][data-closed]";

/**
 * 閉じるアニメーションを 60 秒に延ばす。読み込み中のダイアログを閉じたあと、アニメーションが終わってから
 * 戻る実装 (退行) では、その窓の間に読み込みが終わると本物のダイアログが替わって開く。その退行で落ちるよう、
 * 窓を読み込みの決着より長く保つ。
 * 返す関数は、閉じる途中の要素に style が効いていたか。掴めなくなるとアニメーションが即座に終わり、退行でも通る
 */
export function slowDownClosingDialogs(): () => boolean {
  enableAnimations();
  const slowClose = document.createElement("style");
  slowClose.textContent = `${CLOSING_DIALOG_SELECTOR} { animation-duration: 60s !important; }`;
  document.head.append(slowClose);
  onTestFinished(() => slowClose.remove());
  let slowedWhileClosing = false;
  const watchClosing = new MutationObserver(() => {
    // locator は使えない: 戻る実装では閉じかけの要素は直ちに外れ、retry の間隔では捉えられない
    const closing = document.querySelector(CLOSING_DIALOG_SELECTOR);
    if (closing && getComputedStyle(closing).animationDuration === "60s") {
      slowedWhileClosing = true;
      watchClosing.disconnect();
    }
  });
  watchClosing.observe(document.body, { attributes: true, subtree: true });
  onTestFinished(() => watchClosing.disconnect());
  return () => slowedWhileClosing;
}
