import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toast";
import { updateNote } from "@/features/notes/functions";
import type { Note } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { NOTE, OTHER_NOTE } from "@/features/notes/schema.test-helpers";
import { formatCalendarDateLabel } from "@/lib/format-calendar-date-label";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { deferMock } from "@/test/app/defer-mock";
import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent } from "@/test/assert/absent";
import { readAnnouncements } from "@/test/assert/live-announcer";
import { expectDialogOpen, expectText } from "@/test/assert/screen-assertions";
import { enableAnimations } from "@/test/browser/animations";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

import { noteEditDialogHandle } from "../-lib/note-edit-dialog-handle";
import {
  bodyTextbox,
  dueDateTrigger,
  expectNoteDialogClosed,
  noteEditTriggerName,
  openNoteEditDialog,
  saveButton,
  titleTextbox,
} from "./note-create-dialog.test-helpers";
import { NoteEditDialog } from "./note-edit-dialog";

/**
 * Root (NoteEditDialog) と detached trigger を handle で結ぶ本番と同じ配線で描画する。
 * trigger は本番では一覧の各行にあるので、ここでは同じ handle と payload を渡した最小の
 * ボタンで代用する。名前は行ごとに変えて、どの行の trigger かを区別する。
 */
async function renderDialog(notes: Note[] = [NOTE]) {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      {notes.map((note) => (
        <DialogTrigger
          key={note.id}
          handle={noteEditDialogHandle}
          payload={note}
          render={<Button />}
        >
          {noteEditTriggerName(note)}
        </DialogTrigger>
      ))}
      <NoteEditDialog />
      <Toaster />
    </QueryClientProvider>,
  );
  return { screen, invalidateSpy };
}

describe("NoteEditDialog", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // curateMutationErrorMessage が raw error を warn に残す。失敗系テストの出力を汚さない
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("開くと見出しと、対象のメモの今の値が入ったフォームが現れる", async () => {
    const { screen } = await renderDialog();

    await openNoteEditDialog(screen, NOTE);

    await expect
      .element(screen.getByRole("heading", { name: "メモを編集", exact: true }))
      .toBeInTheDocument();
    await expect.element(bodyTextbox(screen)).toHaveValue(NOTE.body);
    expect.assert(NOTE.dueDate !== null);
    await expect
      .element(dueDateTrigger(screen))
      .toHaveAccessibleName(
        `${NOTE_FIELD_LABELS.dueDate} ${formatCalendarDateLabel(NOTE.dueDate, "long")}`,
      );
    // Trigger で開くと payload は開いた後の描画で届く。その間を欠落と取り違えて warn しない
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("[NoteEditDialog]"));
  });

  it("開いた直後のフォーカスが先頭の入力にある", async () => {
    // 作成と同じフォーム部品を使い、autoFocus を渡さず base-ui の既定 (ポップアップ内の最初の
    // tabbable) に委ねている。値が入っていても先頭入力から外れないことを固定する
    const { screen } = await renderDialog();

    await openNoteEditDialog(screen, NOTE);

    await expect.element(titleTextbox(screen)).toHaveFocus();
  });

  it("見出しを変えて保存すると updateNote が id と入力の全項目で 1 回呼ばれる", async () => {
    vi.mocked(updateNote).mockResolvedValue(undefined);
    const { screen } = await renderDialog();
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await vi.waitFor(() => {
      expect(vi.mocked(updateNote)).toHaveBeenCalledExactlyOnceWith({
        data: { id: NOTE.id, title: "変えた見出し", body: NOTE.body, dueDate: NOTE.dueDate },
      });
    });
  });

  it("updateNote の応答でダイアログが閉じ、notes クエリを invalidate する", async () => {
    // 完了点 (b): 応答前は開いたまま、応答で閉じる (ADR-0017)。即 resolve だと応答前の窓が観測できない
    const update = deferMock(updateNote);
    const { screen, invalidateSpy } = await renderDialog();
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await expect.element(saveButton(screen)).toHaveAttribute("aria-busy", "true");
    await expectDialogOpen(screen, "dialog");

    update.resolve(undefined);

    await expectNoteDialogClosed(screen);
    // 一覧の再取得は invalidateQueries に委ねる。キーがずれると保存後に一覧が古いままになる
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
  });

  it("保存に失敗すると固定文言を toast に出し、開いたまま入力を保つ", async () => {
    vi.mocked(updateNote).mockRejectedValue(new Error("更新できませんでした"));
    const { screen } = await renderDialog();
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expect.element(titleTextbox(screen)).toHaveValue("変えた見出し");
  });

  it("更新の開始と完了を announcer が通知する", async () => {
    // ダイアログの close も一覧の行の変化も読み上げに出ないので、両端を polite の region で伝える (ADR-0026)
    const update = deferMock(updateNote);
    const { screen } = await renderDialog();
    await openNoteEditDialog(screen, NOTE);

    await saveButton(screen).click();

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain("メモを更新しています");
    });
    // 完了は updateNote の決着より前に出さない
    expect(readAnnouncements()).not.toContain("更新しました");

    update.resolve(undefined);

    await vi.waitFor(() => {
      expect(readAnnouncements()).toContain("更新しました");
    });
  });

  it("閉じる途中で別の行の payload が届くと、前の行の入力を残さずその行の値で開く", async () => {
    // 閉じる animate-out の間は Portal が unmount されず、閉じ終わりの作り直しも走らない。
    // その窓を踏むので animation を戻す (docs/guides/testing/user-interactions.md「animation を戻すテストを書く」)。
    // 窓の間は backdrop が一覧を覆い、別の行の Trigger のクリックは届かない。payload の差し替えを
    // Root に起こすために handle の imperative open を使う
    enableAnimations();
    const { screen } = await renderDialog([NOTE, OTHER_NOTE]);
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill("書きかけ");

    await userEvent.keyboard("{Escape}");
    noteEditDialogHandle.openWithPayload(OTHER_NOTE);

    await expect.element(titleTextbox(screen)).toHaveValue(OTHER_NOTE.title);
    await expect.element(bodyTextbox(screen)).toHaveValue(OTHER_NOTE.body);
  });

  it("閉じてから別の行を開くと、その行の値で開く", async () => {
    const { screen } = await renderDialog([NOTE, OTHER_NOTE]);
    await openNoteEditDialog(screen, NOTE);
    await titleTextbox(screen).fill("書きかけ");

    await screen.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expectNoteDialogClosed(screen);
    await openNoteEditDialog(screen, OTHER_NOTE);

    await expect.element(bodyTextbox(screen)).toHaveValue(OTHER_NOTE.body);
  });

  it("payload 無しで開くと warn を残し、フォームを描かない", async () => {
    // Trigger が 1 つだけ登録されていると、trigger を指定しない open でも Base UI がその Trigger を
    // 選び、payload が入る。Trigger を置かずに開き、payload の来る経路を無くす
    const { screen } = await renderDialog([]);

    noteEditDialogHandle.open(null);

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("[NoteEditDialog] opened with no payload");
    });
    expect(noteEditDialogHandle.isOpen).toBe(true);
    await expectAbsent(titleTextbox(screen));
  });
});
