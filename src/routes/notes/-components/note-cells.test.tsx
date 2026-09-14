import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DataTable } from "@/components/data-table";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";
import {
  CREATED_NOTE,
  NOTE,
  NOTE_CREATED_AT_TEXT,
  OTHER_NOTE,
} from "@/features/notes/schema.test-helpers";
import type { Screen } from "@/test/page-helpers";

import { noteColumns } from "../-lib/note-columns";
import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { getNoteRowId, toNoteRows } from "../-lib/note-rows";

/** 保存中の 1 件。CREATED_NOTE と同じ入力で、id と createdAt をまだ持たない */
const CREATING = {
  submittedAt: 1_700_000_000_000,
  variables: { title: CREATED_NOTE.title, body: CREATED_NOTE.body },
};

/**
 * ページを載せず、列定義 (`noteColumns`) と行の組み立て (`toNoteRows`) を実配線のまま
 * `DataTable` に渡して cell を描く。確認ダイアログの Root は `NoteActionsCell` のトリガーと
 * 同じ handle で同居させる (Root は 1 handle につき 1 つ)。
 */
async function renderCells({
  deletingIds = [],
  creating = false,
  onConfirm = vi.fn(),
}: {
  deletingIds?: number[];
  creating?: boolean;
  onConfirm?: (target: { id: number; name: string }) => void;
} = {}) {
  const rows = toNoteRows({
    notes: [NOTE, OTHER_NOTE],
    creatingRows: creating ? [CREATING] : [],
    deletingIds,
  });
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

function row(screen: Screen, title: string) {
  return screen.getByRole("row", { name: new RegExp(title) });
}

function deleteTrigger(screen: Screen, title: string) {
  return screen.getByRole("button", { name: `${title}を削除`, exact: true });
}

describe("NoteCreatedAtCell", () => {
  it("確定行は作成日時を APP_TIME_ZONE の壁時計で描く", async () => {
    const screen = await renderCells();

    await expect
      .element(row(screen, NOTE.title).getByText(NOTE_CREATED_AT_TEXT))
      .toBeInTheDocument();
  });

  it("保存中の行は日時の位置に「保存中」を描く", async () => {
    const screen = await renderCells({ creating: true });

    await expect.element(row(screen, CREATED_NOTE.title).getByText("保存中")).toBeInTheDocument();
    await expect.element(row(screen, NOTE.title).getByText("保存中")).not.toBeInTheDocument();
  });
});

describe("NoteActionsCell", () => {
  it("確定行は対象を名前に含む有効な削除トリガーを出し、状態テキストは出さない", async () => {
    const screen = await renderCells();

    await expect
      .element(deleteTrigger(screen, NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(deleteTrigger(screen, OTHER_NOTE.title)).toBeInTheDocument();
    await expect.element(row(screen, NOTE.title).getByText("削除中")).not.toBeInTheDocument();
  });

  it("削除中の行だけトリガーを無効にし、読み上げ用の「削除中」を足す", async () => {
    const screen = await renderCells({ deletingIds: [NOTE.id] });

    await expect
      .element(deleteTrigger(screen, NOTE.title))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(row(screen, NOTE.title).getByText("削除中")).toBeInTheDocument();
    // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)
    await expect
      .element(deleteTrigger(screen, OTHER_NOTE.title))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(row(screen, OTHER_NOTE.title).getByText("削除中")).not.toBeInTheDocument();
  });

  it("保存中の行には削除トリガーを出さない (id をまだ持たない)", async () => {
    const screen = await renderCells({ creating: true });

    await expect.element(row(screen, CREATED_NOTE.title)).toBeInTheDocument();
    await expect.element(deleteTrigger(screen, CREATED_NOTE.title)).not.toBeInTheDocument();
    await expect.element(deleteTrigger(screen, NOTE.title)).toBeInTheDocument();
  });

  it("トリガーを押すと同じ handle の確認ダイアログが開き、確定で行の id と title が渡る", async () => {
    const onConfirm = vi.fn();
    const screen = await renderCells({ onConfirm });

    await deleteTrigger(screen, OTHER_NOTE.title).click();

    await expect
      .element(
        screen.getByText(`「${OTHER_NOTE.title}」を削除しますか？この操作は取り消せません。`),
      )
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "削除", exact: true }).click();
    expect(onConfirm).toHaveBeenCalledWith({ id: OTHER_NOTE.id, name: OTHER_NOTE.title });
  });
});
