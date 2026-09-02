import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toast";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { NOTE_FIELD_LABELS, NOTE_TITLE_MAX_LENGTH } from "@/lib/notes-schema";
import { dispatchNativeClick } from "@/test/native-click";
import { createTestQueryClient, expectEmptyTextboxes, expectText } from "@/test/page-helpers";

// server functions は実 DB (better-sqlite3) を掴むため、ブラウザテストからは呼ばせない。
// 呼び出しの形 (引数と戻り値) だけを検証対象にする
vi.mock("@/server/functions/notes", () => ({
  listNotes: vi.fn(),
  createNote: vi.fn(),
  removeNote: vi.fn(),
}));

const { createNote } = await import("@/server/functions/notes");

import { NoteCreateDialog, noteCreateDialogHandle } from "./note-create-dialog";

const OPEN_BUTTON_LABEL = "＋ メモを追加";

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
        {OPEN_BUTTON_LABEL}
      </DialogTrigger>
      <NoteCreateDialog />
      <Toaster />
    </QueryClientProvider>,
  );
  return { screen, invalidateSpy };
}

type Screen = Awaited<ReturnType<typeof renderDialog>>["screen"];

function titleTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.title, exact: true });
}

function bodyTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.body, exact: true });
}

async function openDialog(screen: Screen) {
  await screen.getByRole("button", { name: OPEN_BUTTON_LABEL }).click();
  await vi.waitFor(() => {
    expect(titleTextbox(screen).query()).not.toBeNull();
  });
}

function clickSave(screen: Screen) {
  // ダイアログ内のボタンは inert バックドロップが pointer event を横取りするため native click
  dispatchNativeClick(screen.getByRole("button", { name: "保存", exact: true }).element());
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

    await openDialog(screen);

    expect(bodyTextbox(screen).query()).not.toBeNull();
  });

  it("開いた直後のフォーカスが先頭の入力にある", async () => {
    // autoFocus を渡さず base-ui の既定 (ポップアップ内の最初の tabbable) に委ねている。
    // 途中に tabbable な要素が挟まると先頭入力から外れるため、位置を固定する
    const { screen } = await renderDialog();

    await openDialog(screen);

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(titleTextbox(screen).element());
    });
  });

  it("空のまま保存すると日本語の必須メッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();
    await openDialog(screen);

    clickSave(screen);

    await expectText(screen, `${NOTE_FIELD_LABELS.title}を入力してください`);
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("上限超過のタイトルで保存すると文字数上限のメッセージが出て createNote を呼ばない", async () => {
    const { screen } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("あ".repeat(NOTE_TITLE_MAX_LENGTH + 1));

    clickSave(screen);

    await expectText(
      screen,
      `${NOTE_FIELD_LABELS.title}は ${NOTE_TITLE_MAX_LENGTH} 文字以内で入力してください`,
    );
    expect(vi.mocked(createNote)).not.toHaveBeenCalled();
  });

  it("初回 submit 前はタイトルを空にしてもエラーが出ない (dynamic validation)", async () => {
    const { screen } = await renderDialog();
    await openDialog(screen);

    await titleTextbox(screen).fill("あ");
    await titleTextbox(screen).fill("");

    expect(screen.getByText(`${NOTE_FIELD_LABELS.title}を入力してください`).query()).toBeNull();
  });

  it("入力して保存すると createNote が前後空白を除いた値で呼ばれる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("  買い物リスト  ");
    await bodyTextbox(screen).fill("牛乳とパン");

    clickSave(screen);

    await vi.waitFor(() => {
      expect(vi.mocked(createNote)).toHaveBeenCalledExactlyOnceWith({
        data: { title: "買い物リスト", body: "牛乳とパン" },
      });
    });
  });

  it("保存に成功すると notes クエリを invalidate してダイアログを閉じる", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen, invalidateSpy } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    clickSave(screen);

    await vi.waitFor(() => {
      expect(titleTextbox(screen).query()).toBeNull();
    });
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
  });

  it("保存に成功して再度開くとフォームが初期値に戻る", async () => {
    vi.mocked(createNote).mockResolvedValue({ id: 1 });
    const { screen } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");
    await bodyTextbox(screen).fill("牛乳とパン");

    clickSave(screen);
    await vi.waitFor(() => {
      expect(titleTextbox(screen).query()).toBeNull();
    });
    await openDialog(screen);

    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it("キャンセルで閉じて再度開くとフォームが初期値に戻る", async () => {
    const { screen } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("一時入力");

    dispatchNativeClick(screen.getByRole("button", { name: "キャンセル", exact: true }).element());
    await vi.waitFor(() => {
      expect(titleTextbox(screen).query()).toBeNull();
    });
    await openDialog(screen);

    await expectEmptyTextboxes(screen, [NOTE_FIELD_LABELS.title, NOTE_FIELD_LABELS.body]);
  });

  it("保存に失敗すると固定文言を toast に出し、server の raw message は表示しない", async () => {
    const rawMessage = "ノートを作成しましたが id を取得できませんでした";
    vi.mocked(createNote).mockRejectedValue(new Error(rawMessage));
    const { screen } = await renderDialog();
    await openDialog(screen);
    await titleTextbox(screen).fill("買い物リスト");

    clickSave(screen);

    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    expect(screen.getByText(rawMessage).query()).toBeNull();
    // 失敗時はダイアログを開いたまま保ち、入力をやり直せるようにする
    expect(titleTextbox(screen).query()).not.toBeNull();
  });
});
