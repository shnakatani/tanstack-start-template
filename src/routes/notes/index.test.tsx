import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Toaster } from "@/components/ui/toast";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import type { Note } from "@/lib/notes-schema";
import { expectNoA11yViolations } from "@/test/a11y";
import { createTestRouter } from "@/test/create-test-router";
import { collectLoaderQueryKeys } from "@/test/loader-helpers";
import { dispatchNativeClick } from "@/test/native-click";
import { createTestQueryClient, expectText } from "@/test/page-helpers";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/server/functions/notes", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { listNotes, removeNote } = await import("@/server/functions/notes");

import { loadNotesPageData, Route } from "./index";

const NotesPage = Route.options.component!;

// createdAt は APP_TIME_ZONE の壁時計で描画する。fixture は絶対時刻 (UTC) で固定し、
// 期待値が実行環境のローカル TZ で動かないようにする (2026-08-17T00:30Z = JST 09:30)
const NOTE: Note = {
  id: 1,
  title: "買い物リスト",
  body: "牛乳とパンを買う",
  createdAt: new Date("2026-08-17T00:30:00.000Z"),
};
const NOTE_CREATED_AT_TEXT = "2026-08-17 09:30";

async function renderPage() {
  const queryClient = createTestQueryClient();
  const router = createTestRouter("/notes", () => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <NotesPage />
      </Suspense>
      <Toaster />
    </QueryClientProvider>
  ));
  return render(<RouterProvider router={router} />);
}

type Screen = Awaited<ReturnType<typeof renderPage>>;

/** 行の削除ボタン。アクセシブルネームで行を特定する (確認ダイアログの「削除」と衝突させない) */
function rowDeleteButton(screen: Screen, title: string) {
  return screen.getByRole("button", { name: `${title}を削除`, exact: true });
}

async function openDeleteConfirm(screen: Screen, note: Note) {
  await rowDeleteButton(screen, note.title).click();
  await expectText(screen, `「${note.title}」を削除しますか？この操作は取り消せません。`);
}

function confirmDelete(screen: Screen) {
  // 確認ダイアログのボタンは inert バックドロップが pointer event を横取りするため native click
  dispatchNativeClick(screen.getByRole("button", { name: "削除", exact: true }).element());
}

describe("NotesPage", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listNotes).mockResolvedValue([]);
    // curateMutationErrorMessage が raw error を warn に残す。失敗系テストの出力を汚さない
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("route に loader が定義され、pendingComponent で skeleton が表示される", async () => {
    expect(typeof Route.options.loader).toBe("function");

    const Pending = Route.options.pendingComponent!;
    const router = createTestRouter("/notes", () => <Pending />);
    const screen = await render(<RouterProvider router={router} />);

    expect(screen.getByRole("status", { name: "読み込み中" }).query()).not.toBeNull();
  });

  it("loader が notes を prefetch する", async () => {
    // loader 本体が query で notes クエリを populate することを検証する。
    // 欠落すると pendingComponent 解消後に useSuspenseQuery が再 suspend する
    const queryClient = createTestQueryClient();
    const querySpy = vi.spyOn(queryClient, "query");

    await loadNotesPageData({ context: { queryClient } });

    expect(collectLoaderQueryKeys(querySpy.mock.calls)).toContain(JSON.stringify(["notes"]));
  });

  it("ページ見出しと追加ボタンが表示される", async () => {
    const screen = await renderPage();

    await expectText(screen, "メモ一覧");
    await expectText(screen, "＋ メモを追加");
  });

  it("空状態の描画に a11y 違反が無い", async () => {
    // 実ブラウザで走るため color-contrast (WCAG 1.4.3) を含む。静的 lint (jsx-a11y) と
    // 役割・名前のアサーションでは届かない、算出後の色と ARIA の実値を見る
    const screen = await renderPage();
    await expectText(screen, "メモが登録されていません");

    await expectNoA11yViolations(document.body);
  });

  it("一覧の描画に a11y 違反が無い", async () => {
    // 空状態だけだと Table と行の操作ボタンが検査されない。件数のある状態も通す
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await expectNoA11yViolations(document.body);
  });

  it("0 件のときは空状態の案内が表示される", async () => {
    const screen = await renderPage();

    await expectText(screen, "メモが登録されていません");
    await expectText(screen, "右上の追加ボタンから登録できます");
  });

  it("データありでタイトル・本文・作成日時が行に表示される", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);

    const screen = await renderPage();

    await expectText(screen, NOTE.title);
    await expectText(screen, NOTE.body);
    await expectText(screen, NOTE_CREATED_AT_TEXT);
  });

  it("削除を確認すると removeNote が number の id で呼ばれ、一覧が再取得される", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]).mockResolvedValue([]);
    vi.mocked(removeNote).mockResolvedValue(undefined);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    confirmDelete(screen);

    await vi.waitFor(() => {
      // DeleteTarget は id を string で運ぶ契約なので、server function 呼び出しの手前で
      // number へ戻せていることを固定する
      expect(vi.mocked(removeNote)).toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    });
    // invalidate → refetch が働けば 2 回目の listNotes の結果 (0 件) が反映される
    await expectText(screen, "メモが登録されていません");
    expect(vi.mocked(listNotes).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("削除をキャンセルすると removeNote を呼ばず行が残る", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    dispatchNativeClick(screen.getByRole("button", { name: "キャンセル", exact: true }).element());

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "削除", exact: true }).query()).toBeNull();
    });
    expect(vi.mocked(removeNote)).not.toHaveBeenCalled();
    expect(screen.getByText(NOTE.title).query()).not.toBeNull();
  });

  it("削除に失敗すると固定文言を toast に出し、server の raw message は表示しない", async () => {
    const rawMessage = `削除対象のノートが見つかりません: id=${NOTE.id}`;
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(removeNote).mockRejectedValue(new Error(rawMessage));
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    confirmDelete(screen);

    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    expect(screen.getByText(rawMessage).query()).toBeNull();
  });
});
