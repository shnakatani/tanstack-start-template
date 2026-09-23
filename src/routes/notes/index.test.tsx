import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { noteListFilterSchema } from "@/features/notes/schema";
import { createTestRouter } from "@/test/create-test-router";
import { collectLoaderQueryKeys } from "@/test/loader-helpers";
import { createTestQueryClient } from "@/test/page-helpers";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/features/notes/functions", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { listNotes } = await import("@/features/notes/functions");

import { noteColumns } from "./-lib/note-columns";
import { loadNotesPageData } from "./-lib/notes-page-loader";
import { Route } from "./index";

/**
 * route の定義と loader。ページ本体の描画は -components/notes-page.test.tsx、wrapper (Route hooks と
 * 通知) は route.test.tsx が持つ
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
    // skeleton の列数は列定義から採る。ずれるとロード完了時にレイアウトシフトが出る (ADR-0019)
    await expect.element(screen.getByRole("columnheader")).toHaveLength(noteColumns.length);
  });

  it("loader が deps の q で notes を prefetch する", async () => {
    // loader 本体が query で notes クエリを populate することを検証する。
    // 欠落すると pendingComponent 解消後に useSuspenseQuery が再 suspend する
    const queryClient = createTestQueryClient();
    const querySpy = vi.spyOn(queryClient, "query");

    await loadNotesPageData({ context: { queryClient }, deps: { q: "abc" } });

    expect(collectLoaderQueryKeys(querySpy.mock.calls)).toContain(
      JSON.stringify(["notes", { q: "abc" }]),
    );
    expect(vi.mocked(listNotes)).toHaveBeenCalledWith({ data: { q: "abc" } });
  });

  // stripSearchParams の効きは route.test.tsx「空にして Enter すると q が URL から消える」が見る
  it("route が search を server function と同じ schema で検証し、q を loader の deps にする", () => {
    expect(Route.options.validateSearch).toBe(noteListFilterSchema);
    expect(Route.options.loaderDeps?.({ search: { q: "abc" } })).toEqual({ q: "abc" });
  });
});
