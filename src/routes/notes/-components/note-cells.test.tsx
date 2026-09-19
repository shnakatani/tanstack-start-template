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
import {
  CREATED_NOTE,
  CREATING_ROW,
  NOTE,
  NOTE_CREATED_AT_TEXT,
  OTHER_NOTE,
} from "@/features/notes/schema.test-helpers";

import { noteColumns } from "../-lib/note-columns";
import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { getNoteRowId, toNoteRows } from "../-lib/note-rows";
import { noteRow, rowDeleteButton } from "./note-cells.test-helpers";

/**
 * ページを載せず、列定義 (`noteColumns`) と行の組み立て (`toNoteRows`) を実配線のまま
 * `DataTable` に渡して cell を描く。確認ダイアログの Root は `NoteActionsCell` のトリガーと
 * 同じ handle で同居させる (Root は 1 handle につき 1 つ)。
 */
async function renderCells({
  deletingIds = [],
  creatingRows = [],
  onConfirm = vi.fn(),
}: {
  deletingIds?: number[];
  creatingRows?: CreatingRow[];
  onConfirm?: (target: NoteDeleteTarget) => void;
} = {}) {
  const rows = toNoteRows({ notes: [NOTE, OTHER_NOTE], creatingRows, deletingIds });
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

describe("NoteCreatedAtCell", () => {
  it("確定行は作成日時を APP_TIME_ZONE の壁時計で描く", async () => {
    const screen = await renderCells();

    await expect.element(noteRow(screen, NOTE).getByText(NOTE_CREATED_AT_TEXT)).toBeInTheDocument();
  });

  it("保存中の行は日時の位置に「保存中」を描く", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    await expect.element(noteRow(screen, CREATED_NOTE).getByText("保存中")).toBeInTheDocument();
    await expect.element(noteRow(screen, NOTE).getByText("保存中")).not.toBeInTheDocument();
  });
});

describe("NoteActionsCell", () => {
  it("確定行は対象を名前に含む有効な削除トリガーを出し、状態テキストは出さない", async () => {
    const screen = await renderCells();

    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(rowDeleteButton(screen, OTHER_NOTE.title)).toBeInTheDocument();
    await expect.element(noteRow(screen, NOTE).getByText("削除中")).not.toBeInTheDocument();
  });

  it("削除中の行だけトリガーを無効にし、読み上げ用の「削除中」を足す", async () => {
    const screen = await renderCells({ deletingIds: [NOTE.id] });

    await expect
      .element(rowDeleteButton(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(noteRow(screen, NOTE).getByText("削除中")).toBeInTheDocument();
    // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)
    await expect
      .element(rowDeleteButton(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(noteRow(screen, OTHER_NOTE).getByText("削除中")).not.toBeInTheDocument();
  });

  it("保存中の行には削除トリガーを出さない (id をまだ持たない)", async () => {
    const screen = await renderCells({ creatingRows: [CREATING_ROW] });

    await expect.element(noteRow(screen, CREATED_NOTE)).toBeInTheDocument();
    await expect.element(rowDeleteButton(screen, CREATED_NOTE.title)).not.toBeInTheDocument();
    await expect.element(rowDeleteButton(screen, NOTE.title)).toBeInTheDocument();
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
