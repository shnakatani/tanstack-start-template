import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { cellInColumn } from "@/components/parts/data-table.test-helpers";
import {
  confirmDeleteButton,
  deleteConfirmDescription,
} from "@/components/parts/delete-confirm-dialog.test-helpers";
import { Toaster } from "@/components/ui/toast";
import { createNote, listNotes, removeNote, updateNote } from "@/features/notes/functions";
import { notesQueryOptions } from "@/features/notes/queries";
import type { Note } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import {
  CREATED_NOTE,
  NOTE,
  NOTE_CREATED_AT_TEXT,
  NOTE_UPDATE,
  OTHER_NOTE,
  UPDATED_NOTE,
} from "@/features/notes/schema.test-helpers";
import { formatDateTime } from "@/lib/format-date-time";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { expectNoA11yViolations } from "@/test/a11y/a11y";
import { createTestRouter } from "@/test/app/create-test-router";
import { deferMock } from "@/test/app/defer-mock";
import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { expectAnnouncements, readAnnouncements } from "@/test/assert/live-announcer";
import { expectText, type Screen } from "@/test/assert/screen-assertions";
import { enableAnimations } from "@/test/browser/animations";
import { parkMouse } from "@/test/browser/park-mouse";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

/**
 * debounce の待ちを 1500ms に広げる。実値 (`NOTE_SEARCH_DEBOUNCE_MS`) だと、`mise run verify` の負荷で
 * 1 文字ずつの打鍵の間隔が待ちを超え、途中の文字列で取得が走る (2026-09-23 に実測: "a" "ab" の取得が
 * 混ざって落ちた)。見たいのは「打鍵が止まってから 1 回」であって実値ではない。待ちは assert の
 * 予算 (`ASSERT_TIMEOUT_MS`) より短く保つ。取得の開始をその予算で待つため。
 * vi.mock は hoist されるので、値は factory の中に閉じる (上位の変数を参照できない)
 */
vi.mock(import("../-lib/note-search"), async (importOriginal) => ({
  ...(await importOriginal()),
  NOTE_SEARCH_DEBOUNCE_MS: 1_500,
}));

import { noteRow, rowDeleteButton, rowEditButton } from "./note-cells.test-helpers";
import { NOTE_CREATE_TRIGGER_LABEL, openNoteCreateDialog } from "./note-create-dialog.test-helpers";
import { openNoteEditDialog } from "./note-edit-dialog.test-helpers";
import {
  bodyTextbox,
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./note-form.test-helpers";
import { noteSearchbox } from "./note-search-field.test-helpers";
import { NotesPage } from "./notes-page";

/** page を props 直渡しで描く。route の定義、loader、wrapper (Route hooks と通知) は ../index.test.tsx が持つ */
async function renderPage({
  q = "",
  onQueryChange = () => {},
  queryClient = createTestQueryClient(),
}: {
  q?: string;
  onQueryChange?: (q: string) => void;
  queryClient?: QueryClient;
} = {}) {
  const router = createTestRouter("/notes", () => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <NotesPage q={q} onQueryChange={onQueryChange} />
      </Suspense>
      <Toaster />
    </QueryClientProvider>
  ));
  return render(<RouterProvider router={router} />);
}

const expectDeleteConfirmClosed = vi.defineHelper(async (screen: Screen) => {
  await expectRemoved(confirmDeleteButton(screen));
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
  await expect.element(row).toHaveAttribute("aria-busy", "false");
});

const openDeleteConfirm = vi.defineHelper(async (screen: Screen, note: Note) => {
  await rowDeleteButton(screen, note.title).click();
  await expectText(screen, deleteConfirmDescription(note.title));
  // click で動いた実マウスは、ダイアログが閉じて下の要素が露出する前に退避する。乗ったままだと
  // 露出した要素の hover 配色と transition を axe が測り、色の実測が揺れる
  await parkMouse();
});

/** 追加ダイアログを開いて 1 件分を入力し、保存を確定する (応答の決着は呼び出し側が握る)。 */
const submitCreate = vi.defineHelper(async (screen: Screen, note: Note) => {
  await openNoteCreateDialog(screen);
  await titleTextbox(screen).fill(note.title);
  await bodyTextbox(screen).fill(note.body);
  await saveButton(screen).click();
  // 追加ボタンに乗った実マウスを、ダイアログが閉じる前に退避する (openDeleteConfirm と同じ理由)
  await parkMouse();
});

/**
 * 実イベントの規律のうち、画面側の 2 つをこのファイルが持つ (docs/guides/storybook.md「story とブラウザテストの分担」)。play は合成イベントで
 * 操作するので、story へ移すとリポジトリから消える。
 * - `DeleteConfirmDialog` の確定とキャンセルへ実 pointer が届くこと (`confirmDeleteButton(screen).click()`)
 * - 画面側の二重確定の dedupe (`queryClient.isMutating`)。「確定直後にもう一度 Enter を送っても
 *   removeNote は 1 回しか呼ばれない」が見る。Action 層の guard (`disabled={isPending}`) はこの経路では
 *   代替されないので、`src/components/action/button.test.tsx` が別に持つ
 */
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

  it("打鍵が止まってから 1 回だけ取得し、その間は古い一覧を半透明で残す", async () => {
    const listed = Promise.withResolvers<Note[]>();
    const listing = vi
      .when(vi.mocked(listNotes), { onUnmatched: "throw" })
      .calledWith({ data: { q: "" } })
      .thenResolve([NOTE])
      .calledWith({ data: { q: "abc" } })
      .thenReturn(listed.promise);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    // 1 文字ずつ別の呼び出しで打つ (`fill` は 1 回の input、`type("abc")` は間を置かず 3 文字を
    // 送るので、どちらも打鍵の間に一覧が描き直されない)。debounce が効けば "a" "ab" では取得しない。
    // 打鍵の間隔は待ち (vi.mock で広げた値) より十分短い前提
    await userEvent.click(noteSearchbox(screen));
    await userEvent.keyboard("a");
    await userEvent.keyboard("b");
    await userEvent.keyboard("c");

    // 取得が始まる (= wait を過ぎた) まで待つ
    await expect
      .poll(() => vi.mocked(listNotes).mock.calls)
      .toEqual([[{ data: { q: "" } }], [{ data: { q: "abc" } }]]);
    // 取得中は古い一覧が見えたまま aria-busy になる。`useDeferredValue` を外すと Suspense が
    // 古い木を display: none で隠すので、在るかではなく見えるかで確かめる
    await expect.element(screen.getByText(NOTE.title)).toBeVisible();
    await expect.element(screen.getBySlot("stale-content")).toHaveAttribute("aria-busy", "true");
    await expect.element(screen.getBySlot("stale-content")).toHaveStyle("opacity: 0.6");

    listed.resolve([]);
    await expectText(screen, "『abc』に一致するメモはありません");
    await expect.element(screen.getBySlot("stale-content")).toHaveAttribute("aria-busy", "false");
    await expect.element(screen.getBySlot("stale-content")).toHaveStyle("opacity: 1");
    // 半透明と aria-busy は読み上げに出ないので、決着した結果を通知する (ADR-0027)
    await expectAnnouncements(["『abc』に一致するメモは 0 件です"]);
    expect(listing).toHaveBeenExhausted();
  });

  it("検索語を空に戻すと、無効化済みのキャッシュは再取得の決着後に通知する", async () => {
    const listing = vi
      .when(vi.mocked(listNotes), { onUnmatched: "throw" })
      .calledWith({ data: { q: "" } })
      .thenResolve([NOTE])
      .calledWith({ data: { q: "abc" } })
      .thenResolve([]);
    const queryClient = createTestQueryClient();
    const screen = await renderPage({ queryClient });
    await expectText(screen, NOTE.title);
    const searchbox = noteSearchbox(screen);

    await searchbox.fill("abc");
    await expectAnnouncements(["『abc』に一致するメモは 0 件です"]);

    // 全件の一覧 (inactive) が mutation で無効化された状態を作る。空に戻すと古い 1 件を表示したまま
    // 再取得が走るので、決着 (0 件) までは通知しない
    await queryClient.invalidateQueries({
      queryKey: notesQueryOptions({ q: "" }).queryKey,
      exact: true,
    });
    // 空に戻したあとの再取得は、応答をテストで握る。積み足した応答が使われる順序は
    // docs/guides/testing/mocking.md「戻り値を決める」
    const listed = Promise.withResolvers<Note[]>();
    listing.calledWith({ data: { q: "" } }).thenReturn(listed.promise);
    await searchbox.fill("");
    await expect.poll(() => vi.mocked(listNotes).mock.calls.at(-1)).toEqual([{ data: { q: "" } }]);
    await expectText(screen, NOTE.title);
    // 決着の前に出ないことは時点で読む。早く出ても、最後の並びは同じになる
    expect(readAnnouncements()).toEqual(["『abc』に一致するメモは 0 件です"]);

    listed.resolve([]);
    await expectAnnouncements([
      "『abc』に一致するメモは 0 件です",
      "絞り込みを解除し、メモを全件表示しています",
    ]);
    expect(listing).toHaveBeenExhausted();
  });

  it("無効化済みのキャッシュを再取得している間に直前に通知した条件へ戻ると、再取得中の検索語の件数は通知しない", async () => {
    const listing = vi
      .when(vi.mocked(listNotes), { onUnmatched: "throw" })
      .calledWith({ data: { q: "abc" } })
      .thenResolve([])
      .calledWith({ data: { q: "" } })
      .thenResolve([NOTE]);
    const queryClient = createTestQueryClient();
    // 初期表示の abc は通知しない (ADR-0027)。abc のキャッシュを持った状態から入る
    const screen = await renderPage({ q: "abc", queryClient });
    await expectText(screen, "『abc』に一致するメモはありません");
    const searchbox = noteSearchbox(screen);
    await searchbox.fill("");
    await expectText(screen, NOTE.title);

    // abc の一覧 (inactive) が mutation で無効化された状態を作り、abc に戻したときの再取得を握る
    const abcQueryKey = notesQueryOptions({ q: "abc" }).queryKey;
    await queryClient.invalidateQueries({ queryKey: abcQueryKey, exact: true });
    const refetched = Promise.withResolvers<Note[]>();
    listing.calledWith({ data: { q: "abc" } }).thenReturnOnce(refetched.promise);
    await searchbox.fill("abc");
    await expect
      .poll(() => vi.mocked(listNotes).mock.calls.at(-1))
      .toEqual([{ data: { q: "abc" } }]);
    // 古いキャッシュの abc の一覧が出る。取得中なので通知しない
    await expectText(screen, "『abc』に一致するメモはありません");

    // 決着の前に、直前に通知した条件 (空) へ戻る。一覧は通知済みの全件に戻るので、abc の一覧は
    // 通知しないまま消える (ADR-0027)
    await searchbox.fill("");
    await expectText(screen, NOTE.title);
    // 取得中に abc の件数を通知していれば、全件に戻った時点で並んでいる
    expect(readAnnouncements()).toEqual(["絞り込みを解除し、メモを全件表示しています"]);
    refetched.resolve([]);
    expect(listing).toHaveBeenExhausted();
  });

  it("入力欄の値は URL と同じ正規化 (trim) を通して取得し、確定する", async () => {
    const onQueryChange = vi.fn();
    const screen = await renderPage({ onQueryChange });
    const searchbox = noteSearchbox(screen);

    // 前後の空白は key に入れない (入れると URL 経由の key と別のキャッシュになる)
    await searchbox.fill(" abc ");
    await expect
      .poll(() => vi.mocked(listNotes).mock.calls)
      .toContainEqual([{ data: { q: "abc" } }]);
    // 空状態の見出しも正規化後の値で描く (『 abc 』にならない)
    await expectText(screen, "『abc』に一致するメモはありません");

    await userEvent.keyboard("{Enter}");

    // 確定も正規化後の値。入力欄も揃う (URL が動かない submit でも trim が見える)
    expect(onQueryChange).toHaveBeenCalledExactlyOnceWith("abc");
    await expect.element(searchbox).toHaveValue("abc");
  });

  it("ページ見出しと追加ボタンが表示される", async () => {
    const screen = await renderPage();

    await expectText(screen, "メモ一覧");
    await expectText(screen, NOTE_CREATE_TRIGGER_LABEL);
  });

  it("空状態の描画に a11y 違反が無い", { tags: ["a11y", "axe"] }, async (context) => {
    // 実ブラウザで走るため color-contrast (WCAG 1.4.3) を含む。静的 lint (jsx-a11y) と
    // 役割・名前のアサーションでは届かない、算出後の色と ARIA の実値を見る
    const screen = await renderPage();
    await expectText(screen, "メモが登録されていません");

    await expectNoA11yViolations(document.body, context);
  });

  it("一覧の描画に a11y 違反が無い", { tags: ["a11y", "axe"] }, async (context) => {
    // 空状態だけだと Table と行の操作ボタンが検査されない。件数のある状態も通す
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await expectNoA11yViolations(document.body, context);
  });

  it("0 件のときは空状態の案内が表示される", async () => {
    const screen = await renderPage();

    await expectText(screen, "メモが登録されていません");
    await expectText(screen, "右上の追加ボタンから登録できます");
  });

  it("データありでタイトル・本文・作成日時・更新日時が行に表示される", async () => {
    // 作成日時と更新日時が違う行で、それぞれの列に出ることを見る
    vi.mocked(listNotes).mockResolvedValue([UPDATED_NOTE]);

    const screen = await renderPage();

    await expectText(screen, UPDATED_NOTE.title);
    await expectText(screen, UPDATED_NOTE.body);
    const row = noteRow(screen, UPDATED_NOTE);
    await expect
      .element(cellInColumn(screen, row, NOTE_FIELD_LABELS.createdAt))
      .toHaveTextContent(NOTE_CREATED_AT_TEXT);
    await expect
      .element(cellInColumn(screen, row, NOTE_FIELD_LABELS.updatedAt))
      .toHaveTextContent(formatDateTime(UPDATED_NOTE.updatedAt));
  });

  it(
    "行を編集して保存すると、再取得完了までその行だけが編集後の値で busy になる",
    { tags: ["axe"] },
    async (context) => {
      // 完了点 (b): 応答でダイアログが閉じるので、再取得完了までの pending は行だけが伝える (ADR-0017)
      vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]);
      const refetch = deferMock(listNotes);
      const update = deferMock(updateNote);
      const screen = await renderPage();
      await expectText(screen, NOTE.title);

      await openNoteEditDialog(screen, NOTE);
      await titleTextbox(screen).fill(UPDATED_NOTE.title);
      await saveButton(screen).click();
      // 行の編集ボタンに乗った実マウスを、ダイアログが閉じる前に退避する (openDeleteConfirm と同じ理由)
      await parkMouse();

      // 応答前から、対象の行は編集後の title で busy になる (モーダル表示中は行が aria-hidden なので includeHidden)
      await expect
        .element(noteRow(screen, UPDATED_NOTE, { includeHidden: true }))
        .toHaveAttribute("aria-busy", "true");
      // 楽観表示の対象は variables の id で選ぶ。isPending だけで塗ると無関係の行まで busy になる
      await expect
        .element(noteRow(screen, OTHER_NOTE, { includeHidden: true }))
        .toHaveAttribute("aria-busy", "false");
      expect(vi.mocked(updateNote)).toHaveBeenCalledExactlyOnceWith({ data: NOTE_UPDATE });

      update.resolve(undefined);

      // 応答でダイアログが閉じ、再取得中も行は busy のまま。止めるのは更新中の行だけ
      await expectNoteDialogClosed(screen);
      await expect.element(noteRow(screen, UPDATED_NOTE)).toHaveAttribute("aria-busy", "true");
      await expect.element(noteRow(screen, UPDATED_NOTE).getByText("更新中")).toBeInTheDocument();
      await expect
        .element(rowEditButton(screen, UPDATED_NOTE.title))
        .toHaveAttribute("aria-disabled", "true");
      await expect
        .element(rowEditButton(screen, OTHER_NOTE.title))
        .not.toHaveAttribute("aria-disabled", "true");
      // 閉じたあと Base UI は開いたトリガーへフォーカスを返す。トリガーは無効になっているが、
      // focusableWhenDisabled なのでフォーカスが body へ落ちない
      await expect.element(rowEditButton(screen, UPDATED_NOTE.title)).toHaveFocus();
      // 更新中の行 (半透明、無効のトリガー、「更新中」) にも a11y 違反が無い。削除中の検査と同じ理由で
      // a11y tag を付けた専用テストへは降ろさない
      await expectNoA11yViolations(document.body, context);

      refetch.resolve([UPDATED_NOTE, OTHER_NOTE]);

      // 再取得の反映で実データの行に戻る (busy でない行が 1 つだけ)
      await expectSettledRow(screen, UPDATED_NOTE);
      await expect
        .element(cellInColumn(screen, noteRow(screen, UPDATED_NOTE), NOTE_FIELD_LABELS.updatedAt))
        .toHaveTextContent(formatDateTime(UPDATED_NOTE.updatedAt));
    },
  );

  it("更新に失敗すると固定文言を toast に出し (server の raw message は表示しない)、行の busy が解けて元の title に戻る", async () => {
    const rawMessage = `更新対象のノートが見つかりません: id=${NOTE.id}`;
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    // 即 reject だと busy の窓が観測できない
    const update = deferMock(updateNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill(UPDATED_NOTE.title);

    await saveButton(screen).click();

    // 応答前は編集後の title で busy になる (モーダル表示中は行が aria-hidden なので includeHidden)
    await expect
      .element(noteRow(screen, UPDATED_NOTE, { includeHidden: true }))
      .toHaveAttribute("aria-busy", "true");

    update.reject(new Error(rawMessage));

    // 直前の expectText が肯定 anchor。無いと expectAbsent は無条件に通る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage, { exact: false }));
    // 失敗では楽観表示を残さない。行は再取得前の値に戻り、busy も解ける。ダイアログは入力を保って
    // 開いたままなので、行はモーダルの下 (aria-hidden) にある
    await expect
      .element(noteRow(screen, NOTE, { includeHidden: true }))
      .toHaveAttribute("aria-busy", "false");
    await expectAbsent(noteRow(screen, UPDATED_NOTE, { includeHidden: true }));
    // raw error は curateMutationErrorMessage が warn に残す (observability)
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith("[mutation] failed", expect.anything());
  });

  it(
    "追加中は新しい行が先頭に半透明で出て、再取得完了で実データに置き換わる",
    { tags: ["axe"] },
    async (context) => {
      // 完了点 (b): 応答でダイアログが閉じるので、再取得完了までの pending は楽観行だけが伝える
      // (`docs/guides/react/updates.md`「操作の型ごとの当て方」)
      vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
      const refetch = deferMock(listNotes);
      const create = deferMock(createNote);
      const screen = await renderPage();
      await expectText(screen, NOTE.title);

      await submitCreate(screen, CREATED_NOTE);

      // 応答前から新しい行が先頭に busy で出る (モーダル表示中は行が aria-hidden なので includeHidden)
      const optimisticRow = noteRow(screen, CREATED_NOTE, { includeHidden: true });
      await expect.element(optimisticRow).toHaveAttribute("aria-busy", "true");

      create.resolve({ id: CREATED_NOTE.id });

      // 応答でダイアログが閉じ、再取得中も行は busy のまま
      await expectNoteDialogClosed(screen);
      await expect.element(noteRow(screen, CREATED_NOTE)).toHaveAttribute("aria-busy", "true");
      // 行は静的テキストで状態を持つ (ADR-0026)。live region にはしないので、仮想カーソルで
      // 行を読んだときにだけ出る。通知は announcer が担う
      await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
      // 一覧は createdAt の降順なので、楽観行は既存行より前に出す
      // rows[0] はヘッダ行
      await expect.element(screen.getByRole("row").nth(1)).toMatchTextContent(CREATED_NOTE.title);
      // 楽観行が出ている状態そのものを検査する。ダイアログが閉じたあとなので、
      // axe が見るのは一覧だけ (開いている間は行が aria-hidden 配下に入る)。
      // この assert の問いは a11y だが、a11y tag を付けた専用テストへは降ろさない。
      // この状態は操作の途中にしか無く、降ろすと操作の再現ぶんが重複する
      await expectNoA11yViolations(document.body, context);

      refetch.resolve([CREATED_NOTE, NOTE]);

      // 実データに置き換わる (busy でない行が 1 つだけ)
      await expectSettledRow(screen, CREATED_NOTE);
    },
  );

  it("応答後の再取得中に開き直した追加ダイアログは、再取得の完了までキャンセルできない", async () => {
    // close を止める条件は mutation の pending。pending は応答後も再取得の完了まで続くので、その間に
    // 開き直したダイアログも閉じられない。応答済みかを再取得中かどうかから推定すると、先行する保存の
    // 再取得と重なったときに応答前でも閉じられ、後から開いたダイアログを先行の応答が閉じる
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    const create = deferMock(createNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await submitCreate(screen, CREATED_NOTE);
    create.resolve({ id: CREATED_NOTE.id });

    // 応答で閉じる。再取得 (2 回目の listNotes) は未決着なので mutation は pending のまま
    await expectNoteDialogClosed(screen);

    await openNoteCreateDialog(screen);
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    await expect.element(cancel).toBeDisabled();

    refetch.resolve([CREATED_NOTE, NOTE]);

    await expect.element(cancel).not.toBeDisabled();
  });

  it("先行する保存の再取得中に保存したダイアログは、その応答が届くまで Escape で閉じない", async () => {
    // 先行の再取得が走っている間に後続の保存を閉じられると、後から開いた別のダイアログを
    // 後続の応答の onSuccess が閉じ、その入力が消える
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]);
    const refetch = deferMock(listNotes);
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
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill(UPDATED_NOTE.title);
    await saveButton(screen).click();
    await parkMouse();
    // 先行の応答で閉じる。再取得は未決着のまま
    await expectNoteDialogClosed(screen);

    await openNoteEditDialog(screen, OTHER_NOTE);
    await titleTextbox(screen).fill(otherUpdate.title);
    await saveButton(screen).click();
    await parkMouse();
    // close を止めていることを描画で確かめてから Escape を送る (pending が描画に届く前に送らない)
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");

    // 閉じない。入力が残っている
    await expect.element(titleTextbox(screen)).toHaveValue(otherUpdate.title);

    secondResponse.resolve(undefined);

    await expectNoteDialogClosed(screen);
    refetch.resolve([UPDATED_NOTE, OTHER_NOTE]);
    expect(updating).toHaveBeenExhausted();
  });

  it("0 件の一覧に 1 件目を追加すると、応答前に空状態が消えて楽観行が出る", async () => {
    // 空状態の分岐は creatingRows も見る。notesQuery.data の件数だけで判定すると、
    // 1 件目の保存中に「登録されていません」と楽観行が同時に成立しない (前者が勝つ)
    vi.mocked(listNotes).mockResolvedValueOnce([]).mockResolvedValue([CREATED_NOTE]);
    const create = deferMock(createNote);
    const screen = await renderPage();
    await expectText(screen, "メモが登録されていません");

    await submitCreate(screen, CREATED_NOTE);

    // 応答前 (一覧はまだ 0 件) から楽観行が出て、空状態は消えている
    await expect
      .element(noteRow(screen, CREATED_NOTE, { includeHidden: true }))
      .toHaveAttribute("aria-busy", "true");
    await expectRemoved(screen.getByText("メモが登録されていません"));

    create.resolve({ id: CREATED_NOTE.id });

    // 再取得の反映で実データの行に変わる (busy でない行が 1 つだけ)
    await expectSettledRow(screen, CREATED_NOTE);
  });

  it("削除を確認すると removeNote が number の id で呼ばれ、一覧が再取得される", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]).mockResolvedValue([]);
    vi.mocked(removeNote).mockResolvedValue(undefined);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDeleteButton(screen).click();

    // 行の payload の id がそのまま server function へ渡ることを固定する
    await expect
      .poll(() => vi.mocked(removeNote))
      .toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    // invalidate → refetch が働けば 2 回目の listNotes の結果 (0 件) が反映される
    await expectText(screen, "メモが登録されていません");
    expect(vi.mocked(listNotes).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("削除をキャンセルすると removeNote を呼ばず行が残る", async () => {
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expectDeleteConfirmClosed(screen);
    expect(vi.mocked(removeNote)).not.toHaveBeenCalled();
    await expectText(screen, NOTE.title);
  });

  it("削除に失敗すると固定文言を toast に出し (server の raw message は表示しない)、行の busy が解ける", async () => {
    const rawMessage = `削除対象のノートが見つかりません: id=${NOTE.id}`;
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    // 即 reject だと busy の窓が観測できない
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDeleteButton(screen).click();

    // 完了点 (a) でダイアログは閉じるので、決着までの pending は行の busy だけが伝える
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    remove.reject(new Error(rawMessage));

    // 直前の expectText が肯定 anchor。無いと expectAbsent は無条件に通る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage, { exact: false }));
    // 失敗しても busy を残さない。残ると行のトリガーが disabled のまま固まりリトライできない
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "false");
    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    // raw error は curateMutationErrorMessage が warn に残す (observability)
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith("[mutation] failed", expect.anything());
  });

  it("削除を確定するとダイアログは removeNote の決着を待たずに閉じ、再取得完了まで行が busy のまま", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDeleteButton(screen).click();

    // 確定で閉じる。removeNote は未決着
    await expectDeleteConfirmClosed(screen);
    expect(vi.mocked(removeNote)).toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    remove.resolve(undefined);

    // 応答後も、再取得 (2 回目の listNotes) が決着するまで行は busy のまま
    await expect.poll(() => vi.mocked(listNotes).mock.calls.length).toBeGreaterThanOrEqual(2);
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    refetch.resolve([]);

    await expectText(screen, "メモが登録されていません");
  });

  it("削除中は対象の行が busy になる", { tags: ["axe"] }, async (context) => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]).mockResolvedValue([OTHER_NOTE]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDeleteButton(screen).click();

    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");
    // 楽観表示の対象は variables で選ぶ。isPending だけで塗ると無関係の行まで busy になる
    await expect.element(noteRow(screen, OTHER_NOTE)).toHaveAttribute("aria-busy", "false");
    // 止めるのは削除中の行だけ (ADR-0017「ブロック範囲」)。他の行のトリガーは有効のまま
    await expect
      .element(rowDeleteButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    // 行は静的テキスト (sr-only) で状態を持つ (ADR-0026)
    await expect.element(noteRow(screen, NOTE).getByText("削除中")).toBeInTheDocument();
    // focusableWhenDisabled では native disabled が付かないため、見た目は cva base の
    // data-disabled: が担う (ADR-0020)。半透明 + pointer-events なしを算出スタイルで固定する
    const targetTrigger = rowDeleteButton(screen, NOTE.title);
    await expect.element(targetTrigger).toHaveStyle("opacity: 0.5; pointer-events: none");
    // 削除中の行 (半透明) もコントラスト等の a11y 違反が無い。削除中のトリガー
    // (aria-disabled) と sr-only の状態テキストを含めて測る。楽観行の検査とは対象が違う。
    // 楽観行の検査と同じ理由で、a11y tag を付けた専用テストへは降ろさない。
    // popup を閉じた後の axe は unmount を待ってから (docs/guides/testing/user-interactions.md「animation を戻すテストを書く」)
    await expectDeleteConfirmClosed(screen);
    await expectNoA11yViolations(document.body, context);

    remove.resolve(undefined);

    // 再取得 (2 回目の listNotes) が反映されても、消えるのは対象行だけ。
    // 対象名は announcer の通知にも残るので、行そのもので判定する
    await expectRemoved(noteRow(screen, NOTE));
    await expectText(screen, OTHER_NOTE.title);
  });

  it("削除中でも他の行を削除でき、両方の行が busy になる", async () => {
    const removingNote = Promise.withResolvers<undefined>();
    const removingOther = Promise.withResolvers<undefined>();
    vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER_NOTE]);
    const removing = vi
      .when(vi.mocked(removeNote), { onUnmatched: "throw" })
      .calledWith({ data: { id: NOTE.id } })
      .thenReturn(removingNote.promise)
      .calledWith({ data: { id: OTHER_NOTE.id } })
      .thenReturn(removingOther.promise);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await openDeleteConfirm(screen, NOTE);
    await confirmDeleteButton(screen).click();
    await expectDeleteConfirmClosed(screen);

    await openDeleteConfirm(screen, OTHER_NOTE);
    await confirmDeleteButton(screen).click();

    // 2 件とも、それぞれの id で 1 回ずつ削除を呼んだ (exhausted は「少なくとも 1 回」までしか見ない)
    await expect.poll(() => removing).toHaveBeenExhausted();
    expect(vi.mocked(removeNote)).toHaveBeenCalledTimes(2);
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");
    await expect.element(noteRow(screen, OTHER_NOTE)).toHaveAttribute("aria-busy", "true");

    removingNote.resolve(undefined);
    removingOther.resolve(undefined);

    // 完了の文言は対象名を持つ。持たないと同時削除でどちらが終わったのか分からない (ADR-0026)。
    // このテストは 2 件の完了の順序を固定していないので、並べ替えてから配列ごと比べる
    await expect
      .poll(() => readAnnouncements().toSorted())
      .toEqual(
        [
          "削除しています",
          "削除しています",
          `『${NOTE.title}』を削除しました`,
          `『${OTHER_NOTE.title}』を削除しました`,
        ].toSorted(),
      );
  });

  it("削除の開始と完了を announcer が通知し、完了には対象名を載せる", async () => {
    // 行の半透明も行の消失も読み上げに出ないので、両端を polite の region で伝える (ADR-0026)
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]).mockResolvedValue([]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDeleteButton(screen).click();

    await expectAnnouncements(["削除しています"]);
    // 完了は removeNote の決着より前に出さない。上の expectAnnouncements が開始だけに一致した時点で見ている

    remove.resolve(undefined);

    await expectAnnouncements(["削除しています", `『${NOTE.title}』を削除しました`]);
  });

  it("確定直後にもう一度 Enter を送っても removeNote は 1 回しか呼ばれない", async () => {
    // close の animate-out の窓 (閉じかけのダイアログにボタンが残る間) を踏む検証なので、
    // このテストだけ Base UI の animation を戻す (docs/guides/testing/user-interactions.md「animation を戻すテストを書く」)。無効のままだと 2 発目が
    // unmount 後に届き、guard を外しても通ってしまう
    enableAnimations();
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    // 1 発目は実クリック。2 発目は close の animate-out の間で Playwright が stable 判定で
    // 弾く (locator.click: "element is not stable") ので、クリックで乗ったフォーカスへ Enter を
    // 送る (docs/guides/testing/user-interactions.md「クリックを発火する」。クリックが弾かれたらキーボードで押す)。Base UI の finalFocus は unmount 時
    // (animate-out の後、FloatingFocusManager の effect cleanup) に走るので、animate-out の間は
    // フォーカスが確定ボタンに残る。それを固定する。残っていなければ Enter は別の要素に届き、
    // guard を通らないまま 1 回で緑になる (肯定 anchor。docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await confirmDeleteButton(screen).click();
    await expect.element(confirmDeleteButton(screen)).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(vi.mocked(removeNote)).toHaveBeenCalledOnce();
    // 2 発目が payload 無しで確定へ届いた場合は DeleteConfirmDialog が warn を出す。届いた上で
    // guard に弾かれたことと区別する。発生源を prefix で特定し、無関係な warn で落とさない
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[DeleteConfirmDialog]"),
      expect.anything(),
    );
    // 開始の通知は onMutate が出すので、mutation が 1 回なら通知も 1 回
    expect(readAnnouncements()).toEqual(["削除しています"]);
    remove.resolve(undefined);
  });
});
