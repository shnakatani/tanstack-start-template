import { lazyRouteComponent } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { createNote, listNotes } from "@/features/notes/functions";
import { NOTE_FIELD_LABELS, type Note } from "@/features/notes/schema";
import { CREATED_NOTE, NOTE } from "@/features/notes/schema.test-helpers";
import { APP_NAME } from "@/lib/app-name";
import { expectNoA11yViolations } from "@/test/a11y/a11y";
import { deferMock } from "@/test/app/defer-mock";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { recordFocusins } from "@/test/assert/focusin";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";
import {
  expectDialogOpen,
  expectEmptyTextboxes,
  expectText,
} from "@/test/assert/screen-assertions";
import type { Screen } from "@/test/assert/screen-assertions";
import { parkMouse } from "@/test/browser/park-mouse";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

import { noteEditTriggerName, noteRow } from "./-components/note-cells.test-helpers";
import {
  NOTE_CREATE_LINK_LABEL,
  noteCreateLink,
  openNoteCreateDialog,
} from "./-components/note-create-dialog.test-helpers";
import {
  bodyTextbox,
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./-components/note-form.test-helpers";
import { NOTE_CREATE_DIALOG_TITLE, NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";
import { Route as NoteCreateRoute } from "./new";
import { ariaLabelsOf, renderRoute, serveNotes } from "./route.test-helpers";

/** 追加のリンクから追加ダイアログを開いて 1 件分を入力し、保存を確定する (応答の決着は呼び出し側が握る)。 */
const submitCreate = vi.defineHelper(async (screen: Screen, note: Pick<Note, "title" | "body">) => {
  await openNoteCreateDialog(screen);
  await titleTextbox(screen).fill(note.title);
  await bodyTextbox(screen).fill(note.body);
  await saveButton(screen).click();
  // 追加のリンクに乗った実マウスを、ダイアログが閉じる前に退避する。乗ったままだと、露出した要素の
  // hover 配色と transition を axe が測り、色の実測が揺れる
  await parkMouse();
});

/**
 * 再取得の反映で楽観行が実データの行に置き換わった状態 (busy でない行が 1 つだけ)。
 *
 * 「1 件」と「busy でない」は同時に成立している必要がある。後段の assert が両方を持つ。
 * `expect.element` は retry のたびに locator を引き直し、`.element()` は複数一致で throw
 * するため (vitest の locators docs「strict and throw if multiple elements match」)、
 * 2 件ある間は通らない。前段の `toHaveLength` は失敗時の文言を読めるようにするために置く
 * (strict 違反より「1 件のはずが 2 件」のほうが原因に近い)。消すと診断だけが落ちる。
 */
const expectSettledRow = vi.defineHelper(async (screen: Screen, note: Note) => {
  const row = noteRow(screen, note);
  await expect.element(row).toHaveLength(1);
  await expect.element(row).toHaveStyle("opacity: 1");
});

/** フォームから送る追加の入力。期日は選ばない (`submitCreate` は見出しと本文だけを打つ) */
function createInputOf(note: Pick<Note, "title" | "body">) {
  return { title: note.title, body: note.body, dueDate: null };
}

/**
 * 追加の route の component の chunk の読み込みを握る。返す mock が決着するまで component を読み込み中にし、
 * reject すると読み込みの失敗にする。dev と build では automatic code splitting が component を
 * `lazyRouteComponent` で包み、chunk を読み終えるまで route は pending になる。テストでは root の plugin を
 * 外すので chunk に分かれず (docs/guides/testing/configuration.md「テストの分岐で plugin を外す理由」)、
 * 同じ包み方で作る
 */
function mockCreateRouteChunk() {
  const { component } = NoteCreateRoute.options;
  if (component === undefined) {
    throw new Error("追加の route に component がない");
  }
  const loadChunk = vi.fn<() => Promise<void>>();
  NoteCreateRoute.update({
    component: lazyRouteComponent(async () => {
      await loadChunk();
      return { default: component };
    }),
  });
  // テストが同じ Route インスタンスを使い回すので、後続のテストまで chunk の読み込みを踏む
  onTestFinished(() => {
    NoteCreateRoute.update({ component });
  });
  return loadChunk;
}

describe("/notes/new route", () => {
  beforeEach(() => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
  });

  it("chunk の読み込みが pendingMs を超えると、読み込み中のダイアログを出してからフォームに替える", async () => {
    const chunk = deferMock(mockCreateRouteChunk());
    const { screen } = await renderRoute("/notes", { pendingMs: 0 });

    await noteCreateLink(screen).click();

    await expect
      .element(
        screen.getByRole("dialog", { name: NOTE_CREATE_DIALOG_TITLE }).getByText("読み込み中"),
      )
      .toBeInTheDocument();
    const focused = recordFocusins();

    chunk.resolve();

    await expect.element(titleTextbox(screen)).toHaveFocus();
    // 替わる間に追加のリンクを経ない。focus は直前の toHaveFocus で落ち着いている
    expect(focused.map((target) => target.textContent)).not.toContain(NOTE_CREATE_LINK_LABEL);
  });

  it("読み込み中のダイアログを閉じると一覧へ戻り、その後に chunk が届いてもフォームを開かない", async () => {
    const loadChunk = mockCreateRouteChunk();
    const chunk = deferMock(loadChunk);
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await noteCreateLink(screen).click();
    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    await screen.getByRole("button", { name: "閉じる", exact: true }).click();
    chunk.resolve();

    // chunk の決着が届いたこと (不在を確かめる前の肯定 anchor)
    await expect.poll(() => loadChunk).toHaveResolved();
    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expectAbsent(titleTextbox(screen));
  });

  it("リンクを押さずに開いた読み込み中のダイアログを閉じると、追加のリンクへ focus を移す", async () => {
    // リンクを押して開くと Base UI の既定 (開く前に focus していた要素) でもリンクへ戻り、finalFocus が
    // 効いていなくても通ってしまう。router.navigate で開くと既定の戻し先が無いので、finalFocus だけが決める
    deferMock(mockCreateRouteChunk());
    const { screen, router } = await renderRoute("/notes", { pendingMs: 0 });
    await expect.element(noteCreateLink(screen)).toBeInTheDocument();
    void router.navigate({ to: "/notes/new" });
    await expect.element(screen.getByRole("dialog").getByText("読み込み中")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expect.element(noteCreateLink(screen)).toHaveFocus();
  });

  it("chunk の読み込みに失敗するとダイアログで伝え、再試行で chunk を読み直す", async () => {
    // 再試行が chunk の読み込みをもう 1 回呼ぶことを見る。本物の dynamic import でブラウザが chunk を
    // 取り直すかまでは見ない
    mockCreateRouteChunk()
      .mockRejectedValueOnce(new Error("chunk の読み込みの失敗"))
      .mockResolvedValueOnce(undefined);
    const { screen } = await renderRoute("/notes/new");

    await expect
      .element(screen.getByRole("dialog", { name: "フォームを読み込めませんでした" }))
      .toBeInTheDocument();
    // ページの見出しはダイアログの外の 1 つだけ (RouteErrorContent を置くと 2 つになる)
    await expect
      .element(screen.getByRole("heading", { level: 1, includeHidden: true }))
      .toHaveLength(1);

    await screen.getByRole("button", { name: "再試行" }).click();

    await expect.element(titleTextbox(screen)).toHaveFocus();
  });

  it("chunk の読み込みの失敗のダイアログを閉じると、一覧へ戻り追加のリンクへ focus を移す", async () => {
    mockCreateRouteChunk().mockRejectedValue(new Error("chunk の読み込みの失敗"));
    const { screen, router } = await renderRoute("/notes/new");
    await expect
      .element(screen.getByRole("dialog", { name: "フォームを読み込めませんでした" }))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectRemoved(screen.getByRole("dialog"));
    await expect.element(noteCreateLink(screen)).toHaveFocus();
  });

  it("追加のリンクで開くと、遷移の title を読み上げ、一覧の見出しを経由せずにダイアログの入力欄へ focus を移す", async () => {
    const { screen, router } = await renderRoute("/notes");
    await expect.element(noteCreateLink(screen)).toBeInTheDocument();
    const focused = recordFocusins();

    await noteCreateLink(screen).click();

    await expect.element(titleTextbox(screen)).toHaveFocus();
    expect(router.state.location.pathname).toBe("/notes/new");
    await expectAnnouncements([`${NOTE_CREATE_DIALOG_TITLE} — ${APP_NAME}`]);
    // 開いた直後の onRendered では Base UI の初期 focus がまだ走っておらず、focus は押したリンクに残る。
    // 見出しへ移していれば、入力欄へ移る前に h1 が focusin を受ける
    expect(focused.filter((target) => target.matches("h1"))).toEqual([]);
  });

  it("title をダイアログの名前とアプリ名で組む", async () => {
    // 前のテストが反映した title で通らないよう、描く前に空へ戻す
    document.title = "";
    await renderRoute("/notes/new");

    await expect.poll(() => document.title).toBe(`${NOTE_CREATE_DIALOG_TITLE} — ${APP_NAME}`);
  });

  it("閉じると一覧へ新しい履歴で戻り、絞り込みを保ち、開閉の遷移を読み上げ、追加のリンクへ focus を戻す", async () => {
    const { screen, router } = await renderRoute("/notes?q=abc");
    await openNoteCreateDialog(screen);
    expect(router.state.location.href).toBe("/notes/new?q=abc");

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.href).toBe("/notes?q=abc");
    // 一覧 → 追加 → 一覧。戻るで追加を開き直せる
    expect(router.history.length).toBe(3);
    await expectAnnouncements([
      `${NOTE_CREATE_DIALOG_TITLE} — ${APP_NAME}`,
      `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
    ]);
    // 読み上げの後も、Base UI が戻した focus は見出しへ移らない
    await expect.element(noteCreateLink(screen)).toHaveFocus();
  });

  it("URL を直接開いて閉じると、追加のリンクへ focus を移す", async () => {
    // リンクを押して開くと Base UI の既定 (開く前に focus していた要素) でもリンクへ戻り、finalFocus が
    // 効いていなくても通ってしまう。URL を直接開くと既定の戻し先が無いので、finalFocus だけが決める
    const { screen } = await renderRoute("/notes/new");
    await expect.element(titleTextbox(screen)).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await expectNoteDialogClosed(screen);
    await expect.element(noteCreateLink(screen)).toHaveFocus();
  });

  it("ブラウザの戻るで一覧へ戻ると、追加のリンクへ focus を戻す", async () => {
    // 戻るでは閉じる操作を経ずに route ごと unmount する。そのときも Base UI は finalFocus を呼ぶ。
    // リンクを返さないと focus はダイアログと一緒に外れ、遷移の読み上げが見出しへ移す。router.navigate で
    // 開き、Base UI の既定の戻し先を作らない
    const { screen, router } = await renderRoute("/notes");
    await expect.element(noteCreateLink(screen)).toBeInTheDocument();
    await router.navigate({ to: "/notes/new" });
    await expect.element(titleTextbox(screen)).toHaveFocus();

    router.history.back();

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await expectAnnouncements([
      `${NOTE_CREATE_DIALOG_TITLE} — ${APP_NAME}`,
      `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
    ]);
    await expect.element(noteCreateLink(screen)).toHaveFocus();
  });

  it("開いたまま編集の URL へ移ると、追加のリンクを経ずに編集の入力欄へ focus を移す", async () => {
    // 消える側のダイアログが戻し先に追加のリンクを返すと、替わる編集のダイアログが入力欄へ移すまでの
    // 1 frame だけリンクが focus を受ける
    const fetching = serveNotes([NOTE]);
    const { screen, router } = await renderRoute("/notes");
    await openNoteCreateDialog(screen);
    await expect.element(titleTextbox(screen)).toHaveFocus();
    const focused = recordFocusins();

    await router.navigate({ to: "/notes/$noteId/edit", params: { noteId: NOTE.id } });

    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await expect.element(titleTextbox(screen)).toHaveFocus();
    // focus は直前の toHaveFocus で落ち着いている
    // 追加のリンクはモーダルの背後で aria-hidden になり locator で引けないので、可視ラベルで見分ける
    expect(focused.map((target) => target.textContent)).not.toContain(NOTE_CREATE_LINK_LABEL);
    expect(fetching).toHaveBeenExhausted();
  });

  it("編集のダイアログを開いたまま追加の URL へ移ると、行のリンクを経ずに追加の入力欄へ focus を移す", async () => {
    // 消える編集のダイアログから見ても、追加の route は別のダイアログの route である
    const fetching = serveNotes([NOTE]);
    const { screen, router } = await renderRoute(`/notes/${NOTE.id}/edit`);
    await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
    await expect.element(titleTextbox(screen)).toHaveFocus();
    const focused = recordFocusins();

    await router.navigate({ to: "/notes/new" });

    await expect.element(titleTextbox(screen)).toHaveValue("");
    await expect.element(titleTextbox(screen)).toHaveFocus();
    // focus は直前の toHaveFocus で落ち着いている
    expect(ariaLabelsOf(focused)).not.toContain(noteEditTriggerName(NOTE));
    expect(fetching).toHaveBeenExhausted();
  });

  it("閉じて開き直すと、前に打った入力を残さず空のフォームで開く", async () => {
    const { screen } = await renderRoute("/notes");
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("一時入力");
    await bodyTextbox(screen).fill("一時の本文");
    await userEvent.keyboard("{Escape}");
    await expectNoteDialogClosed(screen);

    await openNoteCreateDialog(screen);

    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it(
    "追加中は新しい行が先頭に半透明で出て、再取得完了で実データに置き換わる",
    { tags: ["axe"] },
    async (context) => {
      // 完了点「サーバー応答」: 応答でダイアログが閉じるので、再取得完了までの pending は楽観行だけが伝える
      // (`docs/guides/react/updates.md`「操作の型ごとの当て方」)
      vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
      const refetch = deferMock(listNotes);
      const create = deferMock(createNote);
      const { screen, router } = await renderRoute("/notes");

      await submitCreate(screen, CREATED_NOTE);

      // 応答前から新しい行が先頭に busy で出る (モーダル表示中は行が aria-hidden なので includeHidden)
      const optimisticRow = noteRow(screen, CREATED_NOTE, { includeHidden: true });
      await expect.element(optimisticRow).toHaveStyle("opacity: 0.6");
      expect(vi.mocked(createNote)).toHaveBeenCalledExactlyOnceWith({
        data: createInputOf(CREATED_NOTE),
      });

      create.resolve({ id: CREATED_NOTE.id });

      // 応答でダイアログが閉じて一覧へ戻り、再取得中も行は busy のまま
      await expectNoteDialogClosed(screen);
      await expect.poll(() => router.state.location.pathname).toBe("/notes");
      await expect.element(noteRow(screen, CREATED_NOTE)).toHaveStyle("opacity: 0.6");
      // 行は静的テキストで状態を持つ (ADR-0026)。live region にはしないので、仮想カーソルで
      // 行を読んだときにだけ出る。通知は announcer が担う
      await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
      // 一覧は createdAt の降順なので、楽観行は既存行より前に出す
      // rows[0] はヘッダ行
      await expect.element(screen.getByRole("row").nth(1)).toMatchTextContent(CREATED_NOTE.title);
      // 閉じたあと Base UI は追加のリンクへ focus を戻す
      await expect.element(noteCreateLink(screen)).toHaveFocus();
      // 楽観行が出ている状態そのものを検査する。ダイアログが閉じたあとなので、
      // axe が見るのは一覧だけ (開いている間は行が aria-hidden 配下に入る)。
      // この assert の問いは a11y だが、a11y tag を付けた専用テストへは降ろさない。
      // この状態は操作の途中にしか無く、降ろすと操作の再現ぶんが重複する
      await expectNoA11yViolations(document.body, context);

      refetch.resolve([CREATED_NOTE, NOTE]);

      // 実データに置き換わる (busy でない行が 1 つだけ)
      await expectSettledRow(screen, CREATED_NOTE);
      // route を離れて unmount したあとも、useMutation に渡した onSuccess が再取得の後に完了を通知する
      await expectAnnouncements([
        `${NOTE_CREATE_DIALOG_TITLE} — ${APP_NAME}`,
        "保存しています",
        `${NOTES_PAGE_TITLE} — ${APP_NAME}`,
        `『${CREATED_NOTE.title}』を保存しました`,
      ]);
    },
  );

  it("0 件の一覧に 1 件目を追加すると、応答前に空状態が消えて楽観行が出る", async () => {
    // 空状態の分岐は creatingRows も見る。notesQuery.data の件数だけで判定すると、
    // 1 件目の保存中に「登録されていません」と楽観行が同時に成立しない (前者が勝つ)
    vi.mocked(listNotes).mockResolvedValueOnce([]).mockResolvedValue([CREATED_NOTE]);
    const create = deferMock(createNote);
    const { screen } = await renderRoute("/notes");
    await expectText(screen, "メモが登録されていません");

    await submitCreate(screen, CREATED_NOTE);

    // 応答前 (一覧はまだ 0 件) から楽観行が出て、空状態は消えている
    await expect
      .element(noteRow(screen, CREATED_NOTE, { includeHidden: true }))
      .toHaveStyle("opacity: 0.6");
    await expectRemoved(screen.getByText("メモが登録されていません"));

    create.resolve({ id: CREATED_NOTE.id });

    // 再取得の反映で実データの行に変わる (busy でない行が 1 つだけ)
    await expectSettledRow(screen, CREATED_NOTE);
  });

  it("応答後の再取得中に開き直した追加ダイアログは、先行の再取得を待たずにキャンセルできる", async () => {
    // 開くたびに route が mount し直すので、mutation もダイアログごとに別になる。先行する保存の pending
    // (再取得中) は、後から開いたダイアログの close を止めない
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    vi.mocked(createNote).mockResolvedValue({ id: CREATED_NOTE.id });
    const { screen } = await renderRoute("/notes");

    await submitCreate(screen, CREATED_NOTE);
    // 応答で閉じる。再取得 (2 回目の listNotes) は未決着なので、先行の mutation は pending のまま
    await expectNoteDialogClosed(screen);
    await expect.element(noteRow(screen, CREATED_NOTE)).toHaveStyle("opacity: 0.6");

    await openNoteCreateDialog(screen);
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    await expect.element(cancel).toBeEnabled();
    await cancel.click();

    await expectNoteDialogClosed(screen);
    refetch.resolve([CREATED_NOTE, NOTE]);
  });

  it("先行する保存の再取得中に開き直して保存すると、その応答が届くまで Escape で閉じない", async () => {
    // close を止めるのは、そのダイアログの保存の pending だけ。先行の保存の再取得と重なっても、後続の保存の
    // 応答の前に閉じると route ごと unmount し、保存に失敗したときに入力が残らない
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    const second = { title: "後続の見出し", body: "後続の本文" };
    const secondResponse = Promise.withResolvers<{ id: number }>();
    const creating = vi
      .when(vi.mocked(createNote), { onUnmatched: "throw" })
      .calledWith({ data: createInputOf(CREATED_NOTE) })
      .thenResolve({ id: CREATED_NOTE.id })
      .calledWith({ data: createInputOf(second) })
      .thenReturn(secondResponse.promise);
    const { screen, router } = await renderRoute("/notes");

    await submitCreate(screen, CREATED_NOTE);
    // 先行の応答で閉じる。再取得は未決着のまま
    await expectNoteDialogClosed(screen);

    await submitCreate(screen, second);
    // close を止めていることを描画で確かめてから Escape を送る
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");

    // 離れても unmount するまでは開いたまま描かれるので、離れていないことは URL で見る。navigate は blocker が
    // 無いと履歴へ同期で積む (`@tanstack/router-core` 1.171.34 の `commitLocation`)
    expect(router.history.location.pathname).toBe("/notes/new");
    await expectDialogOpen(screen, "dialog");
    await expect.element(titleTextbox(screen)).toHaveValue(second.title);

    secondResponse.resolve({ id: 4 });

    await expectNoteDialogClosed(screen);
    refetch.resolve([CREATED_NOTE, NOTE]);
    expect(creating).toHaveBeenExhausted();
  });

  it("保存の応答前に戻るで一覧へ戻り、開き直したダイアログは、先行の保存の応答が届いても開いたまま残る", async () => {
    // 戻るは close を止める判定を通らず、route ごと unmount する。先行の onSuccess が閉じるのは自分の
    // ダイアログ (unmount 済み) だけで、開き直したダイアログには届かない
    const firstResponse = Promise.withResolvers<{ id: number }>();
    vi.mocked(createNote).mockReturnValue(firstResponse.promise);
    const { screen, router } = await renderRoute("/notes");
    await submitCreate(screen, CREATED_NOTE);
    await expect.element(saveButton(screen)).toBeDisabled();

    router.history.back();

    await expectNoteDialogClosed(screen);
    await expect.poll(() => router.state.location.pathname).toBe("/notes");
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("後から打った見出し");

    firstResponse.resolve({ id: CREATED_NOTE.id });

    // 先行の保存の完了の通知が、先行の onSuccess が最後まで走ったことの肯定 anchor
    await expect
      .poll(() => readAnnouncements())
      .toContain(`『${CREATED_NOTE.title}』を保存しました`);
    await expect.element(titleTextbox(screen)).toHaveValue("後から打った見出し");
    expect(router.state.location.pathname).toBe("/notes/new");
  });
});
