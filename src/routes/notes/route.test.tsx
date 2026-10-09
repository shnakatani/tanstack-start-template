import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  HeadContent,
  notFound,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { RouteErrorContent } from "@/components/screens/route-error";
import { Toaster } from "@/components/ui/toast";
import { getNote, listNotes, updateNote } from "@/features/notes/functions";
import { NOTE_QUERY_MAX_LENGTH } from "@/features/notes/schema";
import type { Note } from "@/features/notes/schema";
import { NOTE, NOTE_UPDATE, OTHER_NOTE, UPDATED_NOTE } from "@/features/notes/schema.test-helpers";
import { APP_NAME } from "@/lib/app-name";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { expectNoA11yViolations } from "@/test/a11y/a11y";
import { createTestRouter } from "@/test/app/create-test-router";
import { deferMock } from "@/test/app/defer-mock";
import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent } from "@/test/assert/absent";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";
import { expectText } from "@/test/assert/screen-assertions";
import { parkMouse } from "@/test/browser/park-mouse";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

// この画面に固有のテストの書き方 (route 全般の書き方は docs/guides/testing/route-wrappers.md「route の wrapper をテストする」、debounce の打ち方と fake timers を
// 使わない理由は `docs/guides/testing/user-interactions.md`「debounce のある入力をテストする」):
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

import { Route as NoteEditRoute } from "./$noteId.edit";
import { noteRow, rowEditLink } from "./-components/note-cells.test-helpers";
import {
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./-components/note-form.test-helpers";
import { noteSearchbox } from "./-components/note-search-field.test-helpers";
import { noteColumns } from "./-lib/note-columns";
import { NOTE_EDIT_DIALOG_TITLE, NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";
import { Route as NotesRoute } from "./route";

/**
 * root だけ差し替えた route tree。生成済み `routeTree.gen.ts` は `__root.tsx` が devtools と
 * `<html>` を描くので browser test では使えない (docs/guides/testing/route-wrappers.md「route の wrapper をテストする」)。root は本番と同じ context 型を持ち、
 * 一覧と編集の `Route` は生成コードと同じ `update({ id, path, getParentRoute })` で付ける。
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

const routeTree = testRootRoute.addChildren([
  notesRoute.addChildren([NoteEditRoute.update(editAttachment)]),
]);

/**
 * wrapper (`Route.useSearch` / `Route.useNavigate`) を実 router で動かし、URL → props と
 * 操作 → URL の往復を見る (TanStack Router how-to「Test Router with File-Based Routing」の形を
 * memory history で)。props 直渡しの page テスト (-components/notes-page.test.tsx) では wrapper が一度も実行されない
 */
async function renderRoute(initialLocation: string, { pendingMs }: { pendingMs?: number } = {}) {
  const queryClient = createTestQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
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
 * route の定義と、wrapper (Route hooks と通知) の実 router での往復。
 * ページ本体の描画は -components/notes-page.test.tsx が持つ
 */
describe("/notes route", () => {
  beforeEach(() => {
    vi.mocked(listNotes).mockResolvedValue([]);
  });

  it("route に loader が定義され、pendingComponent で skeleton が表示される", async () => {
    expect(typeof NotesRoute.options.loader).toBe("function");

    const Pending = NotesRoute.options.pendingComponent!;
    const router = createTestRouter("/notes", () => <Pending />);
    const screen = await render(<RouterProvider router={router} />);

    await expect.element(screen.getByRole("cell", { name: "読み込み中" })).toBeInTheDocument();
    // skeleton は NOTE_COLUMN_HEADERS の見出しを全部描く。列定義がそれと過不足なく同じ順に並ぶことをここで見る。
    // ずれるとロード完了時にレイアウトシフトが出る (`docs/guides/lists-and-search.md`「一覧テーブルを組む」)
    await expect
      .poll(() =>
        screen
          .getByRole("columnheader")
          .elements()
          .map((header) => header.textContent),
      )
      .toEqual(noteColumns.map((column) => column.header));
  });

  it("title をページ名とアプリ名で組む", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    await renderRoute("/notes");

    await expect.poll(() => document.title).toBe(`${NOTES_PAGE_TITLE} — ${APP_NAME}`);
  });

  it("URL の q が loader と入力欄に届く", async () => {
    const { screen } = await renderRoute("/notes?q=abc");

    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // loader が取得した key を component が読むので 1 回。loaderDeps が無いと空の deps の取得が先に走る
    expect(vi.mocked(listNotes)).toHaveBeenCalledExactlyOnceWith({ data: { q: "abc" } });
    // 初期表示は結果の入れ替わりではないので通知しない (spy が無ければ throw する helper)
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
    // 確定後の結果を通知する (debounce が明ける前の Enter でも落とさない。ADR-0027)
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);
    // 入力欄は作り直されず、フォーカスが残る (key={q} でページを作り直すと body へ落ちる)
    await expect.element(noteSearchbox(screen)).toHaveFocus();
  });

  it("確定した後に URL の q が元の値へ戻っても、確定済みの編集は復活せず入力欄も一覧も q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    // xyz の結果の通知を待ってから戻る。待たずに戻ると、遅い環境では xyz の結果が決着する前に abc へ
    // 戻り、abc は通知済みとして扱う条件 (ref の初期値の URL の q) と同じなので、どちらの通知も出ない (ADR-0027)
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);

    // 途中入力を挟まずに、別の遷移 (Link や他画面からの戻る) で同じ値へ。編集を URL の値で紐付けると、
    // 同じ値に戻った瞬間に確定済みの編集が復活する
    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    await expectAnnouncements([
      "『xyz』に一致するメモは 0 件です",
      "『abc』に一致するメモは 0 件です",
    ]);
  });

  it("別の遷移で URL の q が変わると、入力欄の途中入力を捨ててその q に揃う", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");

    await noteSearchbox(screen).fill("xyz");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => router.state.location.href).toBe("/notes?q=xyz");
    // xyz の結果の通知を待ってから途中入力を打つ (理由は上のテスト)。待たないと、途中入力が xyz の
    // 世代に届く前の編集になり、「途中入力を捨てる」の前提も揃わない
    await expectAnnouncements(["『xyz』に一致するメモは 0 件です"]);
    await noteSearchbox(screen).fill("typed");

    await router.navigate({ to: "/notes", search: { q: "abc" } });

    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    await expect.element(noteSearchbox(screen)).toHaveValue("abc");
    // 遷移で入れ替わった結果も通知する。同じ条件へ戻っても、直前に通知した条件と違えば出す
    await expectAnnouncements([
      "『xyz』に一致するメモは 0 件です",
      "『abc』に一致するメモは 0 件です",
    ]);
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

/**
 * 一覧と、その各行の getNote の応答を張る。getNote は登録した id でだけ応答する (vi.when)。
 * 戻り値に `toHaveBeenExhausted()` を当て、開いた行の取得が走ったことを閉じる
 */
function serveNotes(notes: Note[]) {
  vi.mocked(listNotes).mockResolvedValue(notes);
  const fetching = vi.when(vi.mocked(getNote), { onUnmatched: "throw" });
  for (const note of notes) {
    fetching.calledWith({ data: { id: note.id } }).thenResolve(note);
  }
  return fetching;
}

describe("/notes/$noteId/edit route", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // curateMutationErrorMessage が raw error を warn に残す。失敗系テストの出力を汚さない
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("編集リンクで開くと、一覧のキャッシュではなく取り直した値でフォームを作る", async () => {
    // 一覧を描いたあとで別のタブが保存した、という状態
    const fresh = { ...NOTE, title: "別のタブで変えた見出し" };
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(getNote).mockResolvedValue(fresh);
    const { screen, router } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();

    await expect.element(titleTextbox(screen)).toHaveValue(fresh.title);
    expect(vi.mocked(getNote)).toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    expect(router.state.location.pathname).toBe(`/notes/${NOTE.id}/edit`);
    // 開いても一覧は取り直さない (一覧の loader は staleTime: "static")
    expect(vi.mocked(listNotes)).toHaveBeenCalledOnce();
  });

  it("閉じたあと戻ると、前に取った値ではなく取り直した値で開き直す", async () => {
    // staleReloadMode が既定の background だと、前に取った値のまま開く。取り直しが届くと、触れていない
    // フォームは新しい値へ替わるので、取り直している間に開いていないことを読み込み中のダイアログで見る
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(getNote).mockResolvedValueOnce(NOTE);
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await userEvent.keyboard("{Escape}");
    await expectNoteDialogClosed(screen);
    const refetching = deferMock(getNote);

    router.history.back();

    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    refetching.resolve({ ...NOTE, title: "閉じたあとに変わった見出し" });

    await expect.element(titleTextbox(screen)).toHaveValue("閉じたあとに変わった見出し");
  });

  it("取得している間は押したリンクに Spinner を出す", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER_NOTE]);
    const fetching = deferMock(getNote);
    const { screen } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();

    await expect.element(rowEditLink(screen, NOTE.title).getBySlot("spinner")).toBeInTheDocument();
    await expectAbsent(rowEditLink(screen, OTHER_NOTE.title).getBySlot("spinner"));

    fetching.resolve(NOTE);

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
  });

  it("取得が pendingMs を超えると、読み込み中のダイアログを出してからフォームに替える", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const fetching = deferMock(getNote);
    const { screen } = await renderRoute("/notes", { pendingMs: 0 });

    await rowEditLink(screen, NOTE.title).click();

    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    fetching.resolve(NOTE);

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
  });

  it("閉じると一覧へ新しい履歴で戻り、絞り込みを保ち、開いたリンクへ focus を戻す", async () => {
    const fetching = serveNotes([NOTE]);
    const { screen, router } = await renderRoute("/notes?q=abc");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    // 一覧 → 編集 → 一覧。戻るで編集を開き直せる
    expect(router.history.length).toBe(3);
    await expect.element(rowEditLink(screen, NOTE.title)).toHaveFocus();
    expect(fetching).toHaveBeenExhausted();
  });

  it("URL を直接開いて閉じると、その行の編集リンクへ focus を移す", async () => {
    const fetching = serveNotes([NOTE]);
    const { screen } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    await expect.element(rowEditLink(screen, NOTE.title)).toHaveFocus();
    expect(fetching).toHaveBeenExhausted();
  });

  it("一覧に無い行を直接開いて閉じると、ページの見出しへ枠を出さずに focus を移す", async () => {
    // 絞り込みで行が一覧から外れている
    vi.mocked(listNotes).mockResolvedValue([]);
    vi.mocked(getNote).mockResolvedValue(NOTE);
    const { screen } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    const heading = screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1 });
    await expect.element(heading).toHaveFocus();
    // 見出しは操作できる要素ではないので枠を出さない (ADR-0035)
    await expect.poll(() => heading.element().matches(":focus-visible")).toBe(false);
  });

  it("存在しない id では、ダイアログで見つからないことを伝え、閉じると一覧へ戻る", async () => {
    // 無い id には server function と同じく notFound を投げる
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const fetching = vi
      .when(vi.mocked(getNote), { onUnmatched: "throw" })
      .calledWith({ data: { id: 999 } })
      .thenReject(notFound());
    const { screen, router } = await renderRoute("/notes/999/edit");

    await expect
      .element(screen.getByRole("dialog", { name: "メモが見つかりません" }))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "閉じる", exact: true }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    expect(fetching).toHaveBeenExhausted();
  });

  it("取得に失敗するとダイアログで伝え、再試行で取り直してフォームを出す", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(getNote).mockRejectedValueOnce(new Error("取得の失敗")).mockResolvedValueOnce(NOTE);
    const { screen } = await renderRoute(`/notes/${NOTE.id}/edit`);

    await expect
      .element(screen.getByRole("dialog", { name: "メモを読み込めませんでした" }))
      .toBeInTheDocument();
    // ページの見出しはダイアログの外の 1 つだけ (RouteErrorContent を置くと 2 つになる)
    await expect
      .element(screen.getByRole("heading", { level: 1, includeHidden: true }))
      .toHaveLength(1);

    await screen.getByRole("button", { name: "再試行" }).click();

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    expect(vi.mocked(getNote)).toHaveBeenCalledTimes(2);
  });

  it("title をダイアログの名前とアプリ名で組む", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    const fetching = serveNotes([NOTE]);
    await renderRoute(`/notes/${NOTE.id}/edit`);

    await expect.poll(() => document.title).toBe(`${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`);
    expect(fetching).toHaveBeenExhausted();
  });

  it(
    "保存すると、再取得完了までその行だけが編集後の値で busy になり、その行のリンクは開けない",
    { tags: ["axe"] },
    async (context) => {
      // 完了点「サーバー応答」: 応答でダイアログが閉じるので、再取得完了までの pending は行だけが伝える (ADR-0017)
      vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]);
      const refetch = deferMock(listNotes);
      vi.mocked(getNote).mockResolvedValue(NOTE);
      const update = deferMock(updateNote);
      const { screen, router } = await renderRoute("/notes");
      await rowEditLink(screen, NOTE.title).click();
      await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
      await titleTextbox(screen).fill(UPDATED_NOTE.title);
      await saveButton(screen).click();
      // 行の編集リンクに乗った実マウスを、ダイアログが閉じる前に退避する
      await parkMouse();

      // 応答前から、対象の行は編集後の title で busy になる (モーダル表示中は行が aria-hidden なので includeHidden)
      await expect
        .element(noteRow(screen, UPDATED_NOTE, { includeHidden: true }))
        .toHaveStyle("opacity: 0.6");
      await expect
        .element(noteRow(screen, OTHER_NOTE, { includeHidden: true }))
        .toHaveStyle("opacity: 1");
      expect(vi.mocked(updateNote)).toHaveBeenCalledExactlyOnceWith({ data: NOTE_UPDATE });

      update.resolve(undefined);

      await expectNoteDialogClosed(screen);
      await expect.poll(() => router.state.location.pathname).toBe("/notes");
      await expect.element(noteRow(screen, UPDATED_NOTE)).toHaveStyle("opacity: 0.6");
      await expect.element(noteRow(screen, UPDATED_NOTE).getByText("更新中")).toBeInTheDocument();
      const busyLink = rowEditLink(screen, UPDATED_NOTE.title);
      await expect.element(busyLink).toHaveAttribute("aria-disabled", "true");
      await expect
        .element(rowEditLink(screen, OTHER_NOTE.title))
        .not.toHaveAttribute("aria-disabled");
      // 閉じたあと Base UI は開いたリンクへ focus を返す。リンクは無効だが tab 順に残るので body へ落ちない
      await expect.element(busyLink).toHaveFocus();
      // 更新中の行 (半透明、無効のリンク、「更新中」) にも a11y 違反が無い
      await expectNoA11yViolations(document.body, context);

      // 無効のリンクは押しても開かない。pointer は pointer-events で見る (docs/guides/testing/user-interactions.md
      // 「クリックを発火する」)。キーボードは focus したまま Enter を送る
      await expect.element(busyLink).toHaveStyle("pointer-events: none");
      await userEvent.keyboard("{Enter}");

      refetch.resolve([UPDATED_NOTE, OTHER_NOTE]);

      await expect
        .element(rowEditLink(screen, UPDATED_NOTE.title))
        .not.toHaveAttribute("aria-disabled");
      expect(router.state.location.pathname).toBe("/notes");
      // 開くときに 1 回だけ取得する。保存後の一覧の invalidate は 1 件のクエリに当たらない
      expect(vi.mocked(getNote)).toHaveBeenCalledOnce();
    },
  );

  it("更新に失敗すると固定文言を toast に出し、開いたまま入力を保ち、行の busy が解ける", async () => {
    const rawMessage = `更新対象のノートが見つかりません: id=${NOTE.id}`;
    const fetching = serveNotes([NOTE]);
    const update = deferMock(updateNote);
    const { screen } = await renderRoute("/notes");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await titleTextbox(screen).fill(UPDATED_NOTE.title);

    await saveButton(screen).click();

    await expect
      .element(noteRow(screen, UPDATED_NOTE, { includeHidden: true }))
      .toHaveStyle("opacity: 0.6");

    update.reject(new Error(rawMessage));

    // 直前の expectText が肯定 anchor (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage, { exact: false }));
    await expect.element(titleTextbox(screen)).toHaveValue(UPDATED_NOTE.title);
    // 失敗では楽観表示を残さない。行は元の値に戻り、busy も解ける (ダイアログの下なので includeHidden)
    await expect.element(noteRow(screen, NOTE, { includeHidden: true })).toHaveStyle("opacity: 1");
    await expectAbsent(noteRow(screen, UPDATED_NOTE, { includeHidden: true }));
    expect(fetching).toHaveBeenExhausted();
  });

  it("先行する保存の再取得中に別の行を保存しても、その応答が届くまで Escape で閉じない", async () => {
    // 開くたびに route が mount し直すので、mutation もダイアログごとに別になる。先行の保存の pending
    // (再取得中) は後から開いたダイアログを止めず、後続の保存の pending だけがそのダイアログを止める
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]);
    const refetch = deferMock(listNotes);
    const fetching = vi
      .when(vi.mocked(getNote), { onUnmatched: "throw" })
      .calledWith({ data: { id: NOTE.id } })
      .thenResolve(NOTE)
      .calledWith({ data: { id: OTHER_NOTE.id } })
      .thenResolve(OTHER_NOTE);
    const secondResponse = Promise.withResolvers<undefined>();
    const otherUpdate = {
      id: OTHER_NOTE.id,
      title: "後続の見出し",
      body: OTHER_NOTE.body,
      dueDate: OTHER_NOTE.dueDate,
    };
    const updating = vi
      .when(vi.mocked(updateNote), { onUnmatched: "throw" })
      .calledWith({ data: NOTE_UPDATE })
      .thenResolve(undefined)
      .calledWith({ data: otherUpdate })
      .thenReturn(secondResponse.promise);
    const { screen } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await titleTextbox(screen).fill(UPDATED_NOTE.title);
    await saveButton(screen).click();
    await parkMouse();
    // 先行の応答で閉じる。再取得は未決着のまま
    await expectNoteDialogClosed(screen);

    await rowEditLink(screen, OTHER_NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(OTHER_NOTE.title);
    // 先行の保存の再取得中でも、後から開いたダイアログはキャンセルできる
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeEnabled();
    await titleTextbox(screen).fill(otherUpdate.title);
    await saveButton(screen).click();
    await parkMouse();
    // close を止めていることを描画で確かめてから Escape を送る
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");

    await expect.element(titleTextbox(screen)).toHaveValue(otherUpdate.title);

    secondResponse.resolve(undefined);

    await expectNoteDialogClosed(screen);
    refetch.resolve([UPDATED_NOTE, OTHER_NOTE]);
    expect(updating).toHaveBeenExhausted();
    expect(fetching).toHaveBeenExhausted();
  });
});
