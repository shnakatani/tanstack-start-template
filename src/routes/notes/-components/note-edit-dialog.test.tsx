import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Toaster } from "@/components/ui/toast";
import { updateNote } from "@/features/notes/functions";
import { noteQueryOptions } from "@/features/notes/queries";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { NOTE } from "@/features/notes/schema.test-helpers";
import { formatCalendarDateLabel } from "@/lib/format-calendar-date-label";
import { MUTATION_ERROR_FALLBACK_MESSAGE } from "@/lib/mutation-error";
import { deferMock } from "@/test/app/defer-mock";
import { createTestQueryClient } from "@/test/app/query-client";
import { expectAbsent } from "@/test/assert/absent";
import { expectAnnouncements } from "@/test/assert/live-announcer";
import { expectDialogOpen, expectText } from "@/test/assert/screen-assertions";

// 差し替え先は src/features/notes/__mocks__/functions.ts
vi.mock(import("@/features/notes/functions"));

import { NOTES_PAGE_TITLE } from "../-lib/notes-page-constants";
import { NoteEditDialog } from "./note-edit-dialog";
import {
  bodyTextbox,
  dueDateTrigger,
  expectNoteDialogClosed,
  saveButton,
  titleTextbox,
} from "./note-form.test-helpers";

/**
 * route の loader が 1 件を取り直した状態 (キャッシュに 1 件がある) で描く。route の出入りは ../route.test.tsx が持つ。
 * ダイアログは一覧のページの上に開くので、閉じたときの focus の移し先になるページの見出しを置く
 */
async function renderDialog() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(noteQueryOptions(NOTE.id).queryKey, NOTE);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const onClosed = vi.fn();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <h1>{NOTES_PAGE_TITLE}</h1>
      <Suspense fallback={null}>
        <NoteEditDialog noteId={NOTE.id} onClosed={onClosed} />
      </Suspense>
      <Toaster />
    </QueryClientProvider>,
  );
  await expect.element(titleTextbox(screen)).toHaveValue(NOTE.title);
  return { screen, invalidateSpy, onClosed };
}

describe("NoteEditDialog", () => {
  it("見出しと、取り直した 1 件の値が入ったフォームで開く", async () => {
    const { screen } = await renderDialog();

    await expect.element(screen.getByRole("heading", { name: "メモを編集" })).toBeInTheDocument();
    await expect.element(bodyTextbox(screen)).toHaveValue(NOTE.body);
    expect.assert(NOTE.dueDate !== null);
    await expect
      .element(dueDateTrigger(screen))
      .toHaveAccessibleName(
        `${NOTE_FIELD_LABELS.dueDate} ${formatCalendarDateLabel(NOTE.dueDate, "long")}`,
      );
  });

  it("開いた直後のフォーカスが先頭の入力にある", async () => {
    // autoFocus を渡さず base-ui の既定 (ポップアップ内の最初の tabbable) に委ねている
    const { screen } = await renderDialog();

    await expect.element(titleTextbox(screen)).toHaveFocus();
  });

  it("見出しを変えて保存すると updateNote が id と入力の全項目で 1 回呼ばれる", async () => {
    vi.mocked(updateNote).mockResolvedValue(undefined);
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await expect
      .poll(() => vi.mocked(updateNote))
      .toHaveBeenCalledExactlyOnceWith({
        data: { id: NOTE.id, title: "変えた見出し", body: NOTE.body, dueDate: NOTE.dueDate },
      });
  });

  it("updateNote の応答で閉じ、一覧のクエリだけを invalidate し、閉じ終わってから route を離れる", async () => {
    // 完了点「サーバー応答」: 応答前は開いたまま、応答で閉じる (ADR-0017)
    const update = deferMock(updateNote);
    const { screen, invalidateSpy, onClosed } = await renderDialog();
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await expect.element(saveButton(screen)).toBeDisabled();
    await expectDialogOpen(screen, "dialog");
    expect(onClosed).not.toHaveBeenCalled();

    update.resolve(undefined);

    await expectNoteDialogClosed(screen);
    // 1 件のクエリは一覧の先頭キーの下に無いので、閉じかけのダイアログの 1 件は取り直さない
    expect(invalidateSpy).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it("送信中は Escape で閉じず、応答が届いてから閉じる", async () => {
    const update = deferMock(updateNote);
    const { screen, onClosed } = await renderDialog();
    await titleTextbox(screen).fill("変えた見出し");
    await saveButton(screen).click();
    // close を止めていることを描画で確かめてから Escape を送る
    await expect.element(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");

    await expect.element(titleTextbox(screen)).toHaveValue("変えた見出し");
    expect(onClosed).not.toHaveBeenCalled();

    update.resolve(undefined);

    await expectNoteDialogClosed(screen);
    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it("キャンセルで閉じると route を離れる", async () => {
    const { screen, onClosed } = await renderDialog();

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expectNoteDialogClosed(screen);
    await expect.poll(() => onClosed).toHaveBeenCalledOnce();
  });

  it("保存に失敗すると固定文言を toast に出し、server の raw message は出さず、開いたまま入力を保つ", async () => {
    // curateMutationErrorMessage が raw error を warn に残す。このテストの出力を汚さない
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rawMessage = "更新対象のノートが見つかりません: id=1";
    vi.mocked(updateNote).mockRejectedValue(new Error(rawMessage));
    const { screen, onClosed } = await renderDialog();
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    // 直前の expectText が肯定 anchor (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, MUTATION_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText(rawMessage, { exact: false }));
    await expect.element(titleTextbox(screen)).toHaveValue("変えた見出し");
    expect(onClosed).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith("[mutation] failed", expect.anything());
  });

  it("更新の開始と完了を announcer が通知し、完了には更新後の見出しを対象名に載せる", async () => {
    const update = deferMock(updateNote);
    const { screen } = await renderDialog();
    await titleTextbox(screen).fill("変えた見出し");

    await saveButton(screen).click();

    await expectAnnouncements(["更新しています"]);

    update.resolve(undefined);

    await expectAnnouncements(["更新しています", "『変えた見出し』を更新しました"]);
  });
});
