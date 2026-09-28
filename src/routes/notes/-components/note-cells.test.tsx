import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DataTable } from "@/components/parts/data-table";
import { DeleteConfirmDialog } from "@/components/parts/delete-confirm-dialog";
import {
  confirmDeleteButton,
  deleteConfirmDescription,
} from "@/components/parts/delete-confirm-dialog.test-helpers";
import type { CreatingRow } from "@/features/notes/creating-rows";
import type { NoteDeleteTarget } from "@/features/notes/mutations";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";
import type { NoteUpdate } from "@/features/notes/schema";
import {
  CREATED_NOTE,
  CREATING_ROW,
  NOTE,
  NOTE_CREATED_AT_TEXT,
  NOTE_UPDATE,
  NOTE_UPDATED_AT_TEXT,
  OTHER_NOTE,
  UPDATED_NOTE,
} from "@/features/notes/schema.test-helpers";
import { formatDateTime } from "@/lib/format-date-time";
import { expectAbsent } from "@/test/assert/absent";

import { noteColumns } from "../-lib/note-columns";
import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { getNoteRowId, toNoteRows } from "../-lib/note-rows";
import {
  noteEditTriggerName,
  noteRow,
  rowDeleteButton,
  rowEditButton,
} from "./note-cells.test-helpers";

/**
 * ページを載せず、列定義 (`noteColumns`) と行の組み立て (`toNoteRows`) を実配線のまま
 * `DataTable` に渡して cell を描く。確認ダイアログの Root は `NoteActionsCell` のトリガーと
 * 同じ handle で同居させる (Root は 1 handle につき 1 つ)。
 */
async function renderCells({
  deletingIds = [],
  creatingRows = [],
  updatingNotes = [],
  onConfirm = vi.fn(),
}: {
  deletingIds?: number[];
  creatingRows?: CreatingRow[];
  updatingNotes?: NoteUpdate[];
  onConfirm?: (target: NoteDeleteTarget) => void;
} = {}) {
  const rows = toNoteRows({ notes: [NOTE, OTHER_NOTE], creatingRows, deletingIds, updatingNotes });
  return await render(
    <>
      <DataTable tableKey="notes" columns={noteColumns} data={rows} getRowId={getNoteRowId} />
      <DeleteConfirmDialog
        handle={noteDeleteDialogHandle}
        entityLabel={NOTE_ENTITY_LABEL}
        onConfirm={onConfirm}
      />
    </>,
  );
}

describe("NoteDueDateCell", () => {
  it("期日のある行は短い書式で、無い行は「—」で描く", async () => {
    const screen = await renderCells();

    // NOTE.dueDate = 2026-08-20、OTHER_NOTE.dueDate = null (schema.test-helpers.ts)
    await expect.element(noteRow(screen, NOTE).getByText("2026/08/20")).toBeInTheDocument();
    await expect
      .element(noteRow(screen, OTHER_NOTE).getByText("—", { exact: true }))
      .toBeInTheDocument();
  });

  it("保存中の行は送信した期日を描く", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    // CREATING_ROW.variables.dueDate = 2026-08-21
    await expect.element(noteRow(screen, CREATED_NOTE).getByText("2026/08/21")).toBeInTheDocument();
  });
});

describe("NoteCreatedAtCell", () => {
  it("確定行は作成日時を APP_TIME_ZONE の壁時計で描く", async () => {
    const screen = await renderCells();

    await expect.element(noteRow(screen, NOTE).getByText(NOTE_CREATED_AT_TEXT)).toBeInTheDocument();
  });

  it("保存中の行は日時の位置に「保存中」を描く", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
    await expectAbsent(noteRow(screen, NOTE).getByText("保存中"));
  });
});

describe("NoteUpdatedAtCell", () => {
  it("確定行は更新日時を APP_TIME_ZONE の壁時計で描く", async () => {
    const screen = await renderCells();

    await expect.element(noteRow(screen, NOTE).getByText(NOTE_UPDATED_AT_TEXT)).toBeInTheDocument();
  });

  it("更新中の行は日時の位置に「更新中」を描き、他の行は日時のまま", async () => {
    const screen = await renderCells({ updatingNotes: [NOTE_UPDATE] });

    // 更新中の行は編集後の title で描く (noteInputOf)
    await expect.element(noteRow(screen, UPDATED_NOTE).getByText("更新中")).toBeInTheDocument();
    await expectAbsent(noteRow(screen, UPDATED_NOTE).getByText(NOTE_UPDATED_AT_TEXT));
    await expect
      .element(noteRow(screen, OTHER_NOTE).getByText(formatDateTime(OTHER_NOTE.updatedAt)))
      .toBeInTheDocument();
  });

  it("保存中の行は更新日時の位置に何も描かない (状態は作成日時の「保存中」が 1 つだけ伝える)", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    // getByText は複数一致で throw するので、「保存中」が行に 1 つだけであることもここで見る
    await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
    await expectAbsent(noteRow(screen, CREATED_NOTE).getByText("更新中"));
  });
});

describe("NoteActionsCell", () => {
  it("確定行は対象を名前に含む有効な削除トリガーを出し、状態テキストは出さない", async () => {
    const screen = await renderCells();

    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(rowDeleteButton(screen, OTHER_NOTE.title)).toBeInTheDocument();
    await expectAbsent(noteRow(screen, NOTE).getByText("削除中"));
  });

  it("削除中の行だけトリガーを無効にし、読み上げ用の「削除中」を足す", async () => {
    const screen = await renderCells({ deletingIds: [NOTE.id] });

    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(noteRow(screen, NOTE).getByText("削除中")).toBeInTheDocument();
    // 止めるのは削除中の行だけ (ADR-0017「ブロック範囲」)
    await expect
      .element(rowDeleteButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expectAbsent(noteRow(screen, OTHER_NOTE).getByText("削除中"));
  });

  it("保存中の行には削除と編集のトリガーを出さない (id をまだ持たない)", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    await expect.element(noteRow(screen, CREATED_NOTE)).toBeInTheDocument();
    await expectAbsent(rowDeleteButton(screen, CREATED_NOTE.title));
    await expectAbsent(rowEditButton(screen, CREATED_NOTE.title));
    await expect.element(rowDeleteButton(screen, NOTE.title)).toBeInTheDocument();
  });

  it("確定行は削除の前に、対象を名前に含む有効な編集トリガーを出す", async () => {
    const screen = await renderCells();

    const edit = rowEditButton(screen, NOTE.title);
    await expect.element(edit).not.toHaveAttribute("aria-disabled", "true");
    await expect.element(rowEditButton(screen, OTHER_NOTE.title)).toBeInTheDocument();
    // 並びは「編集」「削除」の順。cell の中のボタンを文書順で読む
    await expect
      .poll(() =>
        noteRow(screen, NOTE)
          .getByRole("button")
          .elements()
          .map((button) => button.getAttribute("aria-label")),
      )
      .toEqual([noteEditTriggerName(NOTE), `${NOTE.title}を削除`]);
  });

  it("削除中の行は編集トリガーも無効にする", async () => {
    const screen = await renderCells({ deletingIds: [NOTE.id] });

    await expect
      .element(rowEditButton(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    await expect
      .element(rowEditButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
  });

  it("更新中の行は両方のトリガーを無効にし、名前は表示中の (編集後の) title で持つ", async () => {
    const screen = await renderCells({ updatingNotes: [NOTE_UPDATE] });

    // 行に見えている title と、読み上げるトリガーの名前をそろえる。再取得前の note.title を
    // 使うと、見えていない名前で読み上げる
    await expect
      .element(rowEditButton(screen, UPDATED_NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    await expect
      .element(rowDeleteButton(screen, UPDATED_NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    // 止めるのは更新中の行だけ (ADR-0017「ブロック範囲」)
    await expect
      .element(rowEditButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    // 状態のテキストは更新日時の cell の「更新中」が持つ。削除中の sr-only は出さない
    await expectAbsent(noteRow(screen, UPDATED_NOTE).getByText("削除中"));
  });

  it("トリガーを押すと同じ handle の確認ダイアログが開き、確定で行の id と title が渡る", async () => {
    const onConfirm = vi.fn();
    const screen = await renderCells({ onConfirm });

    await rowDeleteButton(screen, OTHER_NOTE.title).click();

    await expect
      .element(screen.getByText(deleteConfirmDescription(OTHER_NOTE.title)))
      .toBeInTheDocument();
    await confirmDeleteButton(screen).click();
    expect(onConfirm).toHaveBeenCalledWith({ id: OTHER_NOTE.id, name: OTHER_NOTE.title });
  });
});
