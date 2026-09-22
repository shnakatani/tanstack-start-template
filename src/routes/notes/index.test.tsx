import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  confirmDeleteButton,
  deleteConfirmDescription,
} from "@/components/parts/delete-confirm-dialog.test-helpers";
import { Toaster } from "@/components/ui/toast";
import type { Note } from "@/features/notes/schema";
import {
  CREATED_NOTE,
  NOTE,
  NOTE_CREATED_AT_TEXT,
  OTHER_NOTE,
} from "@/features/notes/schema.test-helpers";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { expectNoA11yViolations } from "@/test/a11y";
import { expectAbsent, expectRemoved } from "@/test/absent";
import { enableBaseUiAnimations } from "@/test/base-ui-animations";
import { createTestRouter } from "@/test/create-test-router";
import { deferMock } from "@/test/defer-mock";
import { readAnnouncements } from "@/test/live-announcer";
import { collectLoaderQueryKeys } from "@/test/loader-helpers";
import { createTestQueryClient, expectText, type Screen } from "@/test/page-helpers";
import { parkMouse } from "@/test/park-mouse";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/features/notes/functions", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { createNote, listNotes, removeNote } = await import("@/features/notes/functions");

import { noteRow, rowDeleteButton } from "./-components/note-cells.test-helpers";
import {
  bodyTextbox,
  NOTE_CREATE_TRIGGER_LABEL,
  openNoteCreateDialog,
  saveButton,
  titleTextbox,
} from "./-components/note-create-dialog.test-helpers";
import { noteColumns } from "./-lib/note-columns";
import { loadNotesPageData, Route } from "./index";

const NotesPage = Route.options.component!;

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

async function expectCreateDialogClosed(screen: Screen) {
  await expectRemoved(titleTextbox(screen));
}

async function expectDeleteConfirmClosed(screen: Screen) {
  await expectRemoved(confirmDeleteButton(screen));
}

/**
 * 再取得の反映で楽観行が実データの行に置き換わった状態 (busy でない行が 1 つだけ)。
 *
 * 「1 件」と「busy でない」は同時に成立している必要がある。後段の assert が両方を持つ。
 * `expect.element` は retry のたびに locator を引き直し、`.element()` は複数一致で throw
 * するため (vitest の locators docs「strict and throw if multiple elements match」)、
 * 2 件ある間は通らない。前段の `toHaveLength` は失敗時の文言を読めるようにするために置く
 * (strict 違反より「1 件のはずが 2 件」のほうが原因に近い)。消すと診断だけが落ちる。
 */
async function expectSettledRow(screen: Screen, note: Note) {
  const row = noteRow(screen, note);
  await expect.element(row).toHaveLength(1);
  await expect.element(row).not.toHaveAttribute("aria-busy", "true");
}

async function openDeleteConfirm(screen: Screen, note: Note) {
  await rowDeleteButton(screen, note.title).click();
  await expectText(screen, deleteConfirmDescription(note.title));
  // click で動いた実マウスは、ダイアログが閉じて下の要素が露出する前に退避する。乗ったままだと
  // 露出した要素の hover 配色と transition を axe が測り、色の実測が揺れる
  // (testing.md「マウス位置を動かすテストは自分で戻す」)
  await parkMouse();
}

/** 追加ダイアログを開いて 1 件分を入力し、保存を確定する (応答の決着は呼び出し側が握る)。 */
async function submitCreate(screen: Screen, note: Note) {
  await openNoteCreateDialog(screen);
  await titleTextbox(screen).fill(note.title);
  await bodyTextbox(screen).fill(note.body);
  // 保存ボタンは inert バックドロップ越しなのでキーボードで活性化する (testing.md「クリックの発火方法」の順 2)
  saveButton(screen).element().focus();
  await userEvent.keyboard("{Enter}");
  // 追加ボタンに乗った実マウスを、ダイアログが閉じる前に退避する (openDeleteConfirm と同じ理由)
  await parkMouse();
}

async function confirmDelete(screen: Screen) {
  await confirmDeleteButton(screen).click();
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

    await expect.element(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
    // skeleton の列数は列定義から採る。ずれるとロード完了時にレイアウトシフトが出る (ADR-0019)
    await expect.element(screen.getByRole("columnheader")).toHaveLength(noteColumns.length);
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
    await expectText(screen, NOTE_CREATE_TRIGGER_LABEL);
  });

  it("空状態の描画に a11y 違反が無い", { tags: ["a11y"] }, async () => {
    // 実ブラウザで走るため color-contrast (WCAG 1.4.3) を含む。静的 lint (jsx-a11y) と
    // 役割・名前のアサーションでは届かない、算出後の色と ARIA の実値を見る
    const screen = await renderPage();
    await expectText(screen, "メモが登録されていません");

    await expectNoA11yViolations(document.body);
  });

  it("一覧の描画に a11y 違反が無い", { tags: ["a11y"] }, async () => {
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

  it("追加中は新しい行が先頭に半透明で出て、再取得完了で実データに置き換わる", async () => {
    // 完了点 (b): 応答でダイアログが閉じるので、再取得完了までの pending は楽観行だけが伝える
    // (ADR-0016「テンプレートのメモ画面への適用」)
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
    await expectCreateDialogClosed(screen);
    await expect.element(noteRow(screen, CREATED_NOTE)).toHaveAttribute("aria-busy", "true");
    // 行は静的テキストで状態を持つ (ADR-0017)。live region にはしないので、仮想カーソルで
    // 行を読んだときにだけ出る。通知は announcer が担う
    await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
    // 一覧は createdAt の降順なので、楽観行は既存行より前に出す
    // rows[0] はヘッダ行
    await expect.element(screen.getByRole("row").nth(1)).toHaveTextContent(CREATED_NOTE.title);
    // 楽観行が出ている状態そのものを検査する。ダイアログが閉じたあとなので、
    // axe が見るのは一覧だけ (開いている間は行が aria-hidden 配下に入る)。
    // この assert の問いは a11y だが、a11y tag を付けた専用テストへは降ろさない。
    // この状態は操作の途中にしか無く、降ろすと操作の再現ぶんが重複する
    await expectNoA11yViolations(document.body);

    refetch.resolve([CREATED_NOTE, NOTE]);

    // 実データに置き換わる (busy でない行が 1 つだけ)
    await expectSettledRow(screen, CREATED_NOTE);
  });

  it("応答後の再取得中に開き直した追加ダイアログはキャンセルできる", async () => {
    // close を止める窓は「応答前」だけで、mutation の pending 全体ではない。応答で閉じた後は
    // 再取得の完了まで pending が続くが、その間に開き直したダイアログは先行 save の応答を
    // 待っていないので閉じられる (ADR-0016 Decision の完了点 (b) の行)
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    const create = deferMock(createNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await submitCreate(screen, CREATED_NOTE);
    create.resolve({ id: CREATED_NOTE.id });

    // 応答で閉じる。再取得 (2 回目の listNotes) は未決着なので mutation は pending のまま
    await expectCreateDialogClosed(screen);

    await openNoteCreateDialog(screen);

    await expect
      .element(screen.getByRole("button", { name: "キャンセル", exact: true }))
      .not.toBeDisabled();

    refetch.resolve([CREATED_NOTE, NOTE]);
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
    // 出ていた空状態が消えるのを待つ。不在確認ではないので retry の予算が要る (ADR-0031)
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

    await confirmDelete(screen);

    await vi.waitFor(() => {
      // 行の payload の id がそのまま server function へ渡ることを固定する
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

    await screen.getByRole("button", { name: "キャンセル", exact: true }).click();

    await expectDeleteConfirmClosed(screen);
    expect(vi.mocked(removeNote)).not.toHaveBeenCalled();
    await expectText(screen, NOTE.title);
  });

  it("削除に失敗すると固定文言を toast に出し (server の raw message は表示しない)、行の busy が解ける", async () => {
    const rawMessage = `削除対象のノートが見つかりません: id=${NOTE.id}`;
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    // 即 reject だと busy の窓が観測できない (testing.md「遅延 rejection で中間状態を観測」)
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDelete(screen);

    // 完了点 (a) でダイアログは閉じるので、決着までの pending は行の busy だけが伝える
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    remove.reject(new Error(rawMessage));

    // 直前の expectText が肯定 anchor。無いと expectAbsent は無条件に通る (ADR-0031)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage));
    // 失敗しても busy を残さない。残ると行のトリガーが disabled のまま固まりリトライできない
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "false");
    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
  });

  it("削除を確定するとダイアログは removeNote の決着を待たずに閉じ、再取得完了まで行が busy のまま", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]);
    const refetch = deferMock(listNotes);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDelete(screen);

    // 確定で閉じる。removeNote は未決着
    await expectDeleteConfirmClosed(screen);
    expect(vi.mocked(removeNote)).toHaveBeenCalledExactlyOnceWith({ data: { id: NOTE.id } });
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    remove.resolve(undefined);

    // 応答後も、再取得 (2 回目の listNotes) が決着するまで行は busy のまま
    await vi.waitFor(() => {
      expect(vi.mocked(listNotes).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");

    refetch.resolve([]);

    await expectText(screen, "メモが登録されていません");
  });

  it("削除中は対象の行が busy になる", async () => {
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE, OTHER_NOTE]).mockResolvedValue([OTHER_NOTE]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDelete(screen);

    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");
    // 楽観表示の対象は variables で選ぶ。isPending だけで塗ると無関係の行まで busy になる
    await expect.element(noteRow(screen, OTHER_NOTE)).toHaveAttribute("aria-busy", "false");
    // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)。他の行のトリガーは有効のまま
    await expect
      .element(rowDeleteButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    // 行は静的テキスト (sr-only) で状態を持つ (ADR-0017)
    await expect.element(noteRow(screen, NOTE).getByText("削除中")).toBeInTheDocument();
    // focusableWhenDisabled では native disabled が付かないため、見た目は cva base の
    // data-disabled: が担う (ADR-0006)。半透明 + pointer-events なしを算出スタイルで固定する
    const targetTrigger = rowDeleteButton(screen, NOTE.title);
    await expect.element(targetTrigger).toHaveStyle("opacity: 0.5; pointer-events: none");
    // 削除中の行 (半透明) もコントラスト等の a11y 違反が無い。削除中のトリガー
    // (aria-disabled) と sr-only の状態テキストを含めて測る。楽観行の検査とは対象が違う。
    // 楽観行の検査と同じ理由で、a11y tag を付けた専用テストへは降ろさない。
    // popup を閉じた後の axe は unmount を待ってから (testing.md「ブラウザテストの CSS とレイアウト実測」)
    await expectDeleteConfirmClosed(screen);
    await expectNoA11yViolations(document.body);

    remove.resolve(undefined);

    // 再取得 (2 回目の listNotes) が反映されても、消えるのは対象行だけ。
    // 対象名は announcer の通知にも残るので、行そのもので判定する
    await expectRemoved(noteRow(screen, NOTE));
    await expectText(screen, OTHER_NOTE.title);
  });

  it("削除中でも他の行を削除でき、両方の行が busy になる", async () => {
    const removes = new Map<number, PromiseWithResolvers<undefined>>();
    vi.mocked(listNotes).mockResolvedValue([NOTE, OTHER_NOTE]);
    vi.mocked(removeNote).mockImplementation(({ data }) => {
      const pending = Promise.withResolvers<undefined>();
      removes.set(data.id, pending);
      return pending.promise;
    });
    const screen = await renderPage();
    await expectText(screen, NOTE.title);

    await openDeleteConfirm(screen, NOTE);
    await confirmDelete(screen);
    await expectDeleteConfirmClosed(screen);

    await openDeleteConfirm(screen, OTHER_NOTE);
    await confirmDelete(screen);

    await vi.waitFor(() => {
      expect(vi.mocked(removeNote)).toHaveBeenCalledTimes(2);
    });
    await expect.element(noteRow(screen, NOTE)).toHaveAttribute("aria-busy", "true");
    await expect.element(noteRow(screen, OTHER_NOTE)).toHaveAttribute("aria-busy", "true");

    for (const pending of removes.values()) {
      pending.resolve(undefined);
    }

    // 完了の文言は対象名を持つ。持たないと同時削除でどちらが終わったのか分からない (ADR-0017)
    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain(`『${NOTE.title}』を削除しました`);
      expect(readAnnouncements()).toContain(`『${OTHER_NOTE.title}』を削除しました`);
    });
  });

  it("削除の開始と完了を announcer が通知する", async () => {
    // 行の半透明も行の消失も読み上げに出ないので、両端を polite の region で伝える (ADR-0017)
    vi.mocked(listNotes).mockResolvedValueOnce([NOTE]).mockResolvedValue([]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    await confirmDelete(screen);

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain(`『${NOTE.title}』を削除しています`);
    });
    // 完了は removeNote の決着より前に出さない
    expect(readAnnouncements()).not.toContain(`『${NOTE.title}』を削除しました`);

    remove.resolve(undefined);

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain(`『${NOTE.title}』を削除しました`);
    });
  });

  it("確定直後にもう一度 Enter を送っても removeNote は 1 回しか呼ばれない", async () => {
    // close の animate-out の窓 (閉じかけのダイアログにボタンが残る間) を踏む検証なので、
    // このテストだけ Base UI の animation を戻す (ADR-0018)。無効のままだと 2 発目が
    // unmount 後に届き、guard を外しても通ってしまう
    enableBaseUiAnimations();
    vi.mocked(listNotes).mockResolvedValue([NOTE]);
    const remove = deferMock(removeNote);
    const screen = await renderPage();
    await expectText(screen, NOTE.title);
    await openDeleteConfirm(screen, NOTE);

    // 確定はキーボードで (testing.md「クリックの発火方法」の順 2)。
    // close の animate-out の間にもう一度 Enter を送る
    confirmDeleteButton(screen).element().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(vi.mocked(removeNote)).toHaveBeenCalledOnce();
    // 開始の通知は onMutate が出すので、mutation が 1 回なら通知も 1 回
    expect(readAnnouncements()).toEqual([`『${NOTE.title}』を削除しています`]);
    remove.resolve(undefined);
  });
});
