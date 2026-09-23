import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toast";
import { NOTE_FIELD_LABELS, NOTE_TITLE_MAX_LENGTH } from "@/features/notes/schema";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { expectAbsent } from "@/test/absent";
import { deferMock } from "@/test/defer-mock";
import { readAnnouncements } from "@/test/live-announcer";
import {
  createTestQueryClient,
  expectDialogOpen,
  expectEmptyTextboxes,
  expectText,
} from "@/test/page-helpers";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/features/notes/functions", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { createNote } = await import("@/features/notes/functions");

import { NoteCreateDialog, noteCreateDialogHandle } from "./note-create-dialog";
import {
  bodyTextbox,
  NOTE_CREATE_TRIGGER_LABEL,
  openNoteCreateDialog,
  saveButton,
  titleTextbox,
  expectNoteCreateDialogClosed,
} from "./note-create-dialog.test-helpers";

/**
 * Root (NoteCreateDialog) と detached trigger を handle で結ぶ本番と同じ配線で描画する。
 * trigger は本番では route の PageHeader にあるので、ここでは同じ handle を渡した最小の
 * ボタンで代用する。
 */
async function renderDialog() {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <DialogTrigger handle={noteCreateDialogHandle} render={<Button />}>
        {NOTE_CREATE_TRIGGER_LABEL}
      </DialogTrigger>
      <NoteCreateDialog />
      <Toaster />
    </QueryClientProvider>,
  );
  return { screen, invalidateSpy };
}

describe("NoteCreateDialog", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // curateMutationErrorMessage が raw error を warn に残す。失敗系テストの出力を汚さない
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("トリガーを押すとタイトルと本文の入力が現れる", async () => {
    const { screen } = await renderDialog();

    await openNoteCreateDialog(screen);

    await expect.element(bodyTextbox(screen)).toBeInTheDocument();
  });

  it("開いた直後のフォーカスが先頭の入力にある", async () => {
    // autoFocus を渡さず base-ui の既定 (ポップアップ内の最初の tabbable) に委ねている。
    // 途中に tabbable な要素が挟まると先頭入力から外れるため、位置を固定する
    const { screen } = await renderDialog();

    await openNoteCreateDialog(screen);

    await expect.element(titleTextbox(screen)).toHaveFocus();
  });

  it("空のまま保存すると日本語の必須メッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);

    await saveButton(screen).click();

    await expectText(screen, `${NOTE_FIELD_LABELS.title}を入力してください`);
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("上限超過のタイトルで保存すると文字数上限のメッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("あ".repeat(NOTE_TITLE_MAX_LENGTH + 1));

    await saveButton(screen).click();

    await expectText(
      screen,
      `${NOTE_FIELD_LABELS.title}は ${NOTE_TITLE_MAX_LENGTH} 文字以内で入力してください`,
    );
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("初回 submit 前はタイトルを空にしてもエラーが出ない (dynamic validation)", async () => {
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);

    await titleTextbox(screen).fill("あ");
    await titleTextbox(screen).fill("");

    // 肯定 anchor。入力が空になった状態を固定してからエラーの不在を見る (ADR-0045)
    await expect.element(titleTextbox(screen)).toHaveValue("");
    await expectAbsent(screen.getByText(`${NOTE_FIELD_LABELS.title}を入力してください`));
  });

  it("入力して保存すると createNote が前後空白を除いた値で呼ばれる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("  買い物リスト  ");
    await bodyTextbox(screen).fill("牛乳とパン");

    await saveButton(screen).click();

    await vi.waitFor(() => {
      expect(vi.mocked(createNote)).toHaveBeenCalledExactlyOnceWith({
        data: { title: "買い物リスト", body: "牛乳とパン" },
      });
    });
  });

  it("保存に成功すると notes クエリを invalidate してダイアログを閉じる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen, invalidateSpy } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    await expectNoteCreateDialogClosed(screen);
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
  });

  it("保存に成功して再度開くとフォームが初期値に戻る", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");
    await bodyTextbox(screen).fill("牛乳とパン");

    await saveButton(screen).click();
    await expectNoteCreateDialogClosed(screen);
    await openNoteCreateDialog(screen);

    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it("キャンセルで閉じて再度開くとフォームが初期値に戻る", async () => {
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("一時入力");

    await screen.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expectNoteCreateDialogClosed(screen);
    await openNoteCreateDialog(screen);

    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it("保存に失敗すると固定文言を toast に出し、server の raw message は表示しない", async () => {
    const rawMessage = "ノートを作成しましたが id を取得できませんでした";
    vi.mocked(createNote).mockRejectedValue(new Error(rawMessage));
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    // 直前の expectText が肯定 anchor。無いと expectAbsent は無条件に通る (ADR-0045)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage));
    // 失敗時はダイアログを開いたまま保ち、入力をやり直せるようにする
    await expect.element(titleTextbox(screen)).toBeInTheDocument();
  });

  it("createNote の応答でダイアログが閉じ、一覧の再取得の完了は待たない", async () => {
    // 完了点 (b): 閉じるのは応答時点で、再取得の完了は待たない (ADR-0022)。
    // 即 resolve だと応答前の窓が観測できない
    const invalidate = Promise.withResolvers<undefined>();
    const create = deferMock(createNote);
    const { screen, invalidateSpy } = await renderDialog();
    // renderDialog が spy を張った queryClient と同じインスタンスを Provider が持つので、
    // onSuccess の invalidateQueries にこの差し替えが効く
    invalidateSpy.mockImplementation(() => invalidate.promise);
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    // 応答前は pending 表示のまま開いている
    await expect.element(saveButton(screen)).toHaveAttribute("aria-busy", "true");
    await expectDialogOpen(screen, "dialog");

    create.resolve({ id: 1 });

    // 応答で閉じる。invalidateQueries は未決着
    await expectNoteCreateDialogClosed(screen);
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });

    invalidate.resolve(undefined);
  });

  it("保存の開始と完了を announcer が通知する", async () => {
    // ダイアログの close も一覧の行の増加も読み上げに出ないので、両端を polite の region で伝える (ADR-0034)
    const create = deferMock(createNote);
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain("メモを保存しています");
    });
    // 完了は createNote の決着より前に出さない
    expect(readAnnouncements()).not.toContain("保存しました");

    create.resolve({ id: 1 });

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain("保存しました");
    });
  });

  it("検証に失敗したときは開始の通知を出さない", async () => {
    // 開始の announce は検証を通った後に置く。空のまま押しても「保存しています」は出ない
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);

    await saveButton(screen).click();

    await expectText(screen, `${NOTE_FIELD_LABELS.title}を入力してください`);
    expect(readAnnouncements()).toEqual([]);
  });

  it("保存の応答前はキャンセルできず Escape でも閉じない", async () => {
    // handle を複数の対象で共有しないダイアログは、閉じる前に対象を比べられない。pending 中に
    // 閉じて開き直すと DialogContent がアンマウントされてフォームが作り直され、先行 save の
    // 応答が届いた時点で新しい入力ごと閉じる。pending 中はユーザー起点の close を止める
    // (ADR-0022 Decision の完了点 (b) の行)
    const create = deferMock(createNote);
    const { screen } = await renderDialog();
    await openNoteCreateDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    await saveButton(screen).click();
    await expect.element(saveButton(screen)).toHaveAttribute("aria-busy", "true");

    // キャンセルは押せない。Escape は Base UI が閉じようとするのを onOpenChange で止める
    await expect
      .element(screen.getByRole("button", { name: "キャンセル", exact: true }))
      .toBeDisabled();
    await userEvent.keyboard("{Escape}");

    await expectDialogOpen(screen, "dialog");
    await expect.element(titleTextbox(screen)).toBeInTheDocument();

    create.resolve({ id: 1 });

    // 応答 (imperative-action) での close は止めない
    await expectNoteCreateDialogClosed(screen);
  });
});
