import { notFound } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import type { Locator } from "vite-plus/test/browser/context";

import { columnHeaderWidths } from "@/components/parts/data-table.test-helpers";
import { getNote, listNotes, updateNote } from "@/features/notes/functions";
import { noteQueryOptions } from "@/features/notes/queries";
import { NOTE, NOTE_UPDATE, OTHER_NOTE, UPDATED_NOTE } from "@/features/notes/schema.test-helpers";
import { APP_NAME } from "@/lib/app-name";
import { formatDateTime } from "@/lib/format-date-time";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { BACKGROUND_REFETCH_ERROR_MESSAGE } from "@/lib/query-cache-handlers";
import { expectNoA11yViolations } from "@/test/a11y/a11y";
import { deferMock } from "@/test/app/defer-mock";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { recordFocusins } from "@/test/assert/focusin";
import { expectAnnouncements } from "@/test/assert/live-announcer";
import { expectDialogOpen, expectText } from "@/test/assert/screen-assertions";
import type { Screen } from "@/test/assert/screen-assertions";
import { MEDIUM_VIEWPORT, restoreDefaultViewport, setViewport } from "@/test/assert/viewport";
import { parkMouse } from "@/test/browser/park-mouse";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

import { noteEditTriggerName, noteRow, rowEditLink } from "./-components/note-cells.test-helpers";
import {
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./-components/note-form.test-helpers";
import { NOTE_EDIT_DIALOG_TITLE, NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";
import { ariaLabelsOf, renderRoute, serveNotes } from "./route.test-helpers";

/** 一覧の見出しに、枠を出さずに focus があること。見出しは操作できる要素ではないので枠を出さない (ADR-0035) */
const expectNotesHeadingFocused = vi.defineHelper(async (screen: Screen) => {
  const heading = screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1 });
  await expect.element(heading).toHaveFocus();
  await expect.poll(() => heading.element().matches(":focus-visible")).toBe(false);
});

/** 一覧の列見出しの幅。モーダル表示中は一覧が aria-hidden なので includeHidden で引く */
const listColumnHeaderWidths = (screen: Screen) =>
  columnHeaderWidths(screen, { includeHidden: true });

describe("/notes/$noteId/edit route", () => {
  it("編集リンクで開くと、一覧のキャッシュではなく取り直した値でフォームを作り、背後の一覧も取り直す", async () => {
    // 一覧を描いたあとで別のタブが保存した、という状態。更新日時も進む
    const fresh = {
      ...NOTE,
      title: "別のタブで変えた見出し",
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    };
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    vi.mocked(getNote).mockResolvedValue(fresh);
    const { screen, router } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();

    // ダイアログは一覧の取り直しを待たずに開く
    await expect.element(titleTextbox(screen)).toHaveValue(fresh.title);
    expect(vi.mocked(getNote)).toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    expect(router.state.location.pathname).toBe(`/notes/${NOTE.id}/edit`);
    await expect.poll(() => vi.mocked(listNotes)).toHaveBeenCalledTimes(2);

    refetch.resolve([fresh]);

    // 開いている間に、背後の行も取り直した値になる (モーダル表示中は行が aria-hidden なので includeHidden)
    await expect.element(noteRow(screen, fresh, { includeHidden: true })).toBeInTheDocument();
    await expect.element(titleTextbox(screen)).toHaveValue(fresh.title);
  });

  it("取り直した値の更新日時が一覧の行と同じなら、一覧は取り直さない", async () => {
    const fetching = serveNotes([NOTE]);
    const { screen } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    // invalidate は loader の中で 1 件を取り終えたときに呼ぶので、フォームが開いた時点で呼び出しは済んでいる
    expect(vi.mocked(listNotes)).toHaveBeenCalledOnce();
    expect(fetching).toHaveBeenExhausted();
  });

  it.each([
    ["クリック", (link: Locator) => link.click()],
    [
      "キーボード",
      async (link: Locator) => {
        link.element().focus();
        await userEvent.keyboard("{Enter}");
      },
    ],
  ])(
    "編集リンクを%sで開くと、遷移の title を読み上げ、一覧の見出しを経由せずにダイアログの入力欄へ focus を移す",
    async (_, open) => {
      // 開いた直後の onRendered では Base UI の初期 focus がまだ走っておらず、focus は押したリンクに残る。
      // 見出しへ移していれば、入力欄へ移る前に h1 が focusin を受ける
      const fetching = serveNotes([NOTE]);
      const { screen } = await renderRoute("/notes");
      await expect.element(rowEditLink(screen, NOTE.title)).toBeInTheDocument();
      const focused = recordFocusins();

      await open(rowEditLink(screen, NOTE.title));

      await expect.element(titleTextbox(screen)).toHaveFocus();
      await expectAnnouncements([`${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`]);
      expect(focused.filter((target) => target.matches("h1"))).toEqual([]);
      expect(fetching).toHaveBeenExhausted();
    },
  );

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
    const focused = recordFocusins();

    fetching.resolve(NOTE);

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    // 読み込み中のダイアログが本物に替わっても、focus は本物の先頭の入力へ移る
    await expect.element(titleTextbox(screen)).toHaveFocus();
    // 替わる間に行のリンクを経ない。消える側が戻し先にリンクを返すと、本物が入力欄へ移すまでの
    // 1 frame だけリンクが focus を受ける。focus は直前の toHaveFocus で落ち着いている
    expect(ariaLabelsOf(focused)).not.toContain(noteEditTriggerName(NOTE));
  });

  it("読み込み中のダイアログを閉じると一覧へ戻り、その後に取得が終わってもフォームを開かない", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const fetching = deferMock(getNote);
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    await screen.getByRole("button", { name: "閉じる", exact: true }).click();
    fetching.resolve(NOTE);

    // 取得の決着が届いたこと (不在を確かめる前の肯定 anchor)
    await expect
      .poll(() =>
        router.options.context.queryClient.getQueryData(noteQueryOptions(NOTE.id).queryKey),
      )
      .toEqual(NOTE);
    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expectAbsent(titleTextbox(screen));
  });

  it("リンクを押さずに開いた読み込み中のダイアログを閉じると、取得が終わる前でもその行の編集リンクへ focus を移し、取得が終わってもフォームは開かない", async () => {
    // リンクを押して開くと Base UI の既定 (開く前に focus していた要素) でもリンクへ戻り、finalFocus が
    // 効いていなくても通ってしまう。router.navigate で開くと既定の戻し先が無いので、finalFocus だけが決める
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const fetching = deferMock(getNote);
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await expect.element(rowEditLink(screen, NOTE.title)).toBeInTheDocument();
    void router.navigate({ to: "/notes/$noteId/edit", params: { noteId: NOTE.id } });
    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expect.element(rowEditLink(screen, NOTE.title)).toHaveFocus();

    fetching.resolve(NOTE);

    // 取得の決着が届いたこと (不在を確かめる前の肯定 anchor)
    await expect
      .poll(() =>
        router.options.context.queryClient.getQueryData(noteQueryOptions(NOTE.id).queryKey),
      )
      .toEqual(NOTE);
    await expectAbsent(screen.getByRole("dialog"));
    await expectAbsent(titleTextbox(screen));
    await expect.element(rowEditLink(screen, NOTE.title)).toHaveFocus();
    expect(router.state.location.pathname).toBe("/notes");
  });

  it("閉じると一覧へ新しい履歴で戻り、絞り込みを保ち、開閉の遷移を読み上げ、開いたリンクへ focus を戻す", async () => {
    const fetching = serveNotes([NOTE]);
    const { screen, router } = await renderRoute("/notes?q=abc");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    // 一覧 → 編集 → 一覧。戻るで編集を開き直せる
    expect(router.history.length).toBe(3);
    // ダイアログの route との行き来も、ほかの遷移と同じく title を読み上げる (ADR-0035)
    await expectAnnouncements([
      `${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`,
      `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
    ]);
    // 読み上げの後も、Base UI が戻した focus は見出しへ移らない
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

  it("ブラウザの戻るで一覧へ戻ると、開いたリンクへ focus を戻す", async () => {
    // 戻るでは閉じる操作を経ずに route ごと unmount する。そのときも Base UI は finalFocus を呼ぶので、
    // 行のリンクがあればそこへ戻す。無いと focus はダイアログと一緒に外れ、遷移の読み上げが見出しへ移すので、
    // 開いた行の位置を失う
    const fetching = serveNotes([NOTE]);
    const { screen, router } = await renderRoute("/notes");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);

    router.history.back();

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectAnnouncements([
      `${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`,
      `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
    ]);
    // 読み上げの後も、Base UI が戻した focus は見出しへ移らない
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
    await expectNotesHeadingFocused(screen);
  });

  it("一覧に無い行のダイアログからブラウザの戻るで一覧へ戻ると、ページの見出しへ focus を移す", async () => {
    // 戻り先にいて開いた元のリンクが無いので、useRouteDialog の finalFocus が見出しへ移す。route の announcer は
    // focus が見出しに移っているので動かさず、読み上げだけをする
    vi.mocked(listNotes).mockResolvedValue([]);
    vi.mocked(getNote).mockResolvedValue(NOTE);
    const { screen, router } = await renderRoute("/notes");
    const heading = screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1 });
    await expect.element(heading).toBeInTheDocument();
    await router.navigate({ to: "/notes/$noteId/edit", params: { noteId: NOTE.id } });
    await expect.element(titleTextbox(screen)).toHaveFocus();

    router.history.back();

    await expectNoteDialogClosed(screen);
    await expectAnnouncements([
      `${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`,
      `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
    ]);
    await expect.element(heading).toHaveFocus();
  });

  it("一覧に無い行の読み込み中のダイアログを閉じると、ページの見出しへ枠を出さずに focus を移す", async () => {
    // router.navigate で開き、Base UI の既定の戻し先 (開く前に focus していた要素) を作らない
    vi.mocked(listNotes).mockResolvedValue([]);
    const fetching = deferMock(getNote);
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await expect
      .element(screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1 }))
      .toBeInTheDocument();
    void router.navigate({ to: "/notes/$noteId/edit", params: { noteId: NOTE.id } });
    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expectNotesHeadingFocused(screen);

    fetching.resolve(NOTE);
  });

  it("見つからないダイアログを閉じると、ページの見出しへ枠を出さずに focus を移す", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(getNote).mockRejectedValue(notFound());
    const { screen } = await renderRoute("/notes/999/edit");
    await expect
      .element(screen.getByRole("dialog", { name: "メモが見つかりません" }))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expectRemoved(screen.getByRole("dialog"));
    await expectNotesHeadingFocused(screen);
  });

  it("一覧に無い行の取得の失敗のダイアログを閉じると、ページの見出しへ枠を出さずに focus を移す", async () => {
    vi.mocked(listNotes).mockResolvedValue([]);
    vi.mocked(getNote).mockRejectedValue(new Error("取得の失敗"));
    const { screen } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect
      .element(screen.getByRole("dialog", { name: "メモを読み込めませんでした" }))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expectRemoved(screen.getByRole("dialog"));
    await expectNotesHeadingFocused(screen);
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

  it("一覧に行がある id が見つからなければ、見つからないダイアログの背後で一覧を取り直し、その行を消す", async () => {
    // 一覧を描いたあとで別のタブが削除した、という状態
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]);
    const refetch = deferMock(listNotes);
    vi.mocked(getNote).mockRejectedValue(notFound());
    const { screen } = await renderRoute("/notes");

    await rowEditLink(screen, NOTE.title).click();

    // ダイアログは一覧の取り直しを待たずに開く
    const notFoundDialog = screen.getByRole("dialog", { name: "メモが見つかりません" });
    await expect.element(notFoundDialog).toBeInTheDocument();
    await expect.poll(() => vi.mocked(listNotes)).toHaveBeenCalledTimes(2);

    refetch.resolve([OTHER_NOTE]);

    // モーダル表示中は行が aria-hidden なので includeHidden
    await expectRemoved(noteRow(screen, NOTE, { includeHidden: true }));
    await expect.element(noteRow(screen, OTHER_NOTE, { includeHidden: true })).toBeInTheDocument();
    await expect.element(notFoundDialog).toBeInTheDocument();
  });

  it("id の形でない URL では、取得せずにダイアログで見つからないことを伝える", async () => {
    // 取得に回すと getNote の検証が弾き、再試行しても直らない取得の失敗のダイアログになる
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const { screen } = await renderRoute("/notes/abc/edit");

    await expect
      .element(screen.getByRole("dialog", { name: "メモが見つかりません" }))
      .toBeInTheDocument();
    expect(vi.mocked(getNote)).not.toHaveBeenCalled();
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

  it("閉じてから開き直した取得の失敗は、ダイアログだけで伝え、取り直しの失敗の toast を出さない", async () => {
    // 1 回目に取った値はキャッシュに残り、閉じるとそれを読む部品は無くなる。開き直す loader の取り直しが
    // 失敗したとき、キャッシュに値があることだけで「表示中のデータの取り直しの失敗」と扱うと、
    // 失敗のダイアログに toast が重なる
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    vi.mocked(getNote).mockResolvedValueOnce(NOTE).mockRejectedValueOnce(new Error("取得の失敗"));
    const { screen } = await renderRoute("/notes");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await userEvent.keyboard("{Escape}");
    await expectNoteDialogClosed(screen);

    await rowEditLink(screen, NOTE.title).click();

    // 失敗のダイアログが肯定 anchor。toast は loader が失敗を受け取る前に積まれるので、ダイアログが出た
    // 時点で出ていなければ出ない
    await expect
      .element(screen.getByRole("dialog", { name: "メモを読み込めませんでした" }))
      .toBeInTheDocument();
    await expectAbsent(screen.getByText(BACKGROUND_REFETCH_ERROR_MESSAGE, { exact: false }));
    expect(vi.mocked(getNote)).toHaveBeenCalledTimes(2);
    // 通知しない失敗はハンドラの warn にも残さない。失敗は loader を待った route のダイアログが伝えている
    // (router 自身の "Error in route match" の warn は別)
    expect(warn).not.toHaveBeenCalledWith(
      "[query-cache] background refetch failed",
      expect.anything(),
    );
  });

  it("保存のあとの一覧の取り直しが失敗すると、取り直しの失敗の toast を出す", async () => {
    // 一覧は表示したまま。古い行が残ることを、ダイアログの無い画面で toast だけが伝える
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    vi.mocked(getNote).mockResolvedValue(NOTE);
    vi.mocked(updateNote).mockResolvedValue(undefined);
    const { screen } = await renderRoute("/notes");
    await rowEditLink(screen, NOTE.title).click();
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await titleTextbox(screen).fill(UPDATED_NOTE.title);
    await saveButton(screen).click();
    await parkMouse();
    await expectNoteDialogClosed(screen);

    refetch.reject(new Error("Failed to fetch"));

    await expectText(screen, BACKGROUND_REFETCH_ERROR_MESSAGE);
    // raw error は observability のため warn に残す
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[query-cache] background refetch failed",
      expect.anything(),
    );
  });

  it("title をダイアログの名前とアプリ名で組み、ページの見出しは一覧の名前のまま残す", async () => {
    // 受け入れ条件の確認。見出しの行は一覧の route の match から読む。ダイアログの名前が見出しの行に漏れる経路
    // (既定の pending 表示と失敗の画面) は pending.test.tsx と page-name.test.ts が見る
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    const fetching = serveNotes([NOTE]);
    const { screen } = await renderRoute(`/notes/${NOTE.id}/edit`);

    await expect.poll(() => document.title).toBe(`${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`);
    // モーダルのダイアログが外側を aria-hidden で隠すので、includeHidden で引く
    await expect
      .element(
        screen.getByRole("heading", { name: NOTES_PAGE_TITLE, level: 1, includeHidden: true }),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, includeHidden: true }))
      .toHaveLength(1);
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
      // 完了の通知は onSuccess が再取得を待ってから出す。再取得を握っている間に、閉じた遷移の読み上げが出る
      await expectAnnouncements([
        `${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`,
        "更新しています",
        `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
      ]);
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
      // route を離れて unmount したあとも、useMutation に渡した onSuccess が再取得の後に完了を通知する
      await expectAnnouncements([
        `${NOTE_EDIT_DIALOG_TITLE} — ${APP_NAME}`,
        "更新しています",
        `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
        `『${UPDATED_NOTE.title}』を更新しました`,
      ]);
      // 開くときに 1 回だけ取得する。保存後の一覧の invalidate は 1 件のクエリに当たらない
      expect(vi.mocked(getNote)).toHaveBeenCalledOnce();
    },
  );

  it("更新に失敗すると固定文言を toast に出し、開いたまま入力を保ち、行の busy が解ける", async () => {
    // curateMutationErrorMessage が raw error を warn に残す。このテストの出力を汚さない
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    // raw error は curateMutationErrorMessage が warn に残す (observability)
    expect(warn).toHaveBeenCalledExactlyOnceWith("[mutation] failed", expect.anything());
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
    const { screen, router } = await renderRoute("/notes");

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

    // 離れても unmount するまでは開いたまま描かれるので、離れていないことは URL で見る。memory history では、
    // navigate は blocker が無いと履歴へ同期で積む (`@tanstack/router-core` 1.171.34 の `commitLocation`)
    expect(router.history.location.pathname).toBe(`/notes/${OTHER_NOTE.id}/edit`);
    await expectDialogOpen(screen, "dialog");
    await expect.element(titleTextbox(screen)).toHaveValue(otherUpdate.title);

    secondResponse.resolve(undefined);

    await expectNoteDialogClosed(screen);
    refetch.resolve([UPDATED_NOTE, OTHER_NOTE]);
    expect(updating).toHaveBeenExhausted();
    expect(fetching).toHaveBeenExhausted();
  });

  it("開いたまま別のメモの編集の URL へ移ると、打った入力を捨て、移った先の値でフォームを作り直す", async () => {
    // params だけが変わる遷移で同じダイアログを使い回すと、前のメモに打った入力が残ったまま、保存先だけが
    // 移った先のメモになる
    const fetching = serveNotes([NOTE, OTHER_NOTE]);
    vi.mocked(updateNote).mockResolvedValue(undefined);
    const { screen, router } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await titleTextbox(screen).fill("前のメモに打った見出し");

    await router.navigate({ to: "/notes/$noteId/edit", params: { noteId: OTHER_NOTE.id } });

    await expect.element(titleTextbox(screen)).toHaveValue(OTHER_NOTE.title);
    await saveButton(screen).click();

    await expectNoteDialogClosed(screen);
    expect(vi.mocked(updateNote)).toHaveBeenCalledExactlyOnceWith({
      data: {
        id: OTHER_NOTE.id,
        title: OTHER_NOTE.title,
        body: OTHER_NOTE.body,
        dueDate: OTHER_NOTE.dueDate,
      },
    });
    expect(fetching).toHaveBeenExhausted();
  });

  it("開いたまま別のメモの編集の URL へ移ると、前の行のリンクを経ずに移った先の入力欄へ focus を移す", async () => {
    // 消える側のダイアログが戻し先に行のリンクを返すと、替わるダイアログが入力欄へ移すまでの 1 frame だけ
    // リンクが focus を受ける
    const fetching = serveNotes([NOTE, OTHER_NOTE]);
    const { screen, router } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await expect.element(titleTextbox(screen)).toHaveFocus();
    const focused = recordFocusins();

    await router.navigate({ to: "/notes/$noteId/edit", params: { noteId: OTHER_NOTE.id } });

    await expect.element(titleTextbox(screen)).toHaveValue(OTHER_NOTE.title);
    await expect.element(titleTextbox(screen)).toHaveFocus();
    // focus は直前の toHaveFocus で落ち着いている
    expect(ariaLabelsOf(focused)).not.toContain(noteEditTriggerName(NOTE));
    expect(fetching).toHaveBeenExhausted();
  });

  // 操作中の表示 (押したリンクの Spinner、保存後の「更新中」) で一覧の列が動かないこと。列が動くと、
  // 遷移のクロスフェードが旧い像と新しい像の列の差を 2 重に見せる (ADR-0042)。列の合計より狭い幅で見る。
  // 余りの幅が列へ配られない状態でないと、`table-fixed` や size の幅を外しても列は動かない
  describe("760px の幅の一覧の列見出し", () => {
    afterEach(restoreDefaultViewport);

    it("編集を押してからダイアログが開くまで、幅が変わらない", async () => {
      await setViewport(MEDIUM_VIEWPORT);
      vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER_NOTE]);
      const fetching = deferMock(getNote);
      const { screen } = await renderRoute("/notes");
      await expect.element(rowEditLink(screen, NOTE.title)).toBeInTheDocument();
      const before = listColumnHeaderWidths(screen);

      await rowEditLink(screen, NOTE.title).click();
      await expect
        .element(rowEditLink(screen, NOTE.title).getBySlot("spinner"))
        .toBeInTheDocument();

      await expect.poll(() => listColumnHeaderWidths(screen)).toEqual(before);
      fetching.resolve(NOTE);
      await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    });

    it("1 行の一覧で保存してから再取得が終わるまで、幅が変わらない", async () => {
      // 1 行の一覧では、その行の日時が列でいちばん幅の広い中身になる。値を変えずに保存し、中身の変化で
      // 列が動く分を除く
      await setViewport(MEDIUM_VIEWPORT);
      vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
      const refetch = deferMock(listNotes);
      vi.mocked(getNote).mockResolvedValue(NOTE);
      vi.mocked(updateNote).mockResolvedValue(undefined);
      const { screen } = await renderRoute("/notes");
      await rowEditLink(screen, NOTE.title).click();
      await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
      const before = listColumnHeaderWidths(screen);

      await saveButton(screen).click();
      await parkMouse();
      await expectNoteDialogClosed(screen);
      await expect.element(noteRow(screen, NOTE).getByText("更新中")).toBeInTheDocument();

      await expect.poll(() => listColumnHeaderWidths(screen)).toEqual(before);
      const refetched = { ...NOTE, updatedAt: UPDATED_NOTE.updatedAt };
      refetch.resolve([refetched]);
      await expect
        .element(noteRow(screen, NOTE).getByText(formatDateTime(refetched.updatedAt)))
        .toBeInTheDocument();
    });
  });
});
