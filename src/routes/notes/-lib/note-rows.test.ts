import { describe, expect, it } from "vite-plus/test";

import { CREATING_ROW, NOTE, NOTE_UPDATE, OTHER_NOTE } from "@/features/notes/schema.test-helpers";

import type { NoteRow } from "./note-rows";
import { getNoteRowId, isNoteRowBusy, noteInputOf, toNoteRows } from "./note-rows";

type SavedNoteRow = Extract<NoteRow, { kind: "saved" }>;

/** 確定行。既定は NOTE の、削除中でも更新中でもない行で、見たい項目だけを上書きする */
function savedRow(overrides: Partial<Omit<SavedNoteRow, "kind">> = {}): SavedNoteRow {
  return { kind: "saved", note: NOTE, isDeleting: false, pendingUpdate: null, ...overrides };
}

describe("toNoteRows", () => {
  it("入力が全て空なら空配列", () => {
    expect(toNoteRows({ notes: [], creatingRows: [], deletingIds: [], updatingNotes: [] })).toEqual(
      [],
    );
  });

  it("保存中の行を先頭に、確定行をその後ろに並べる", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [CREATING_ROW],
      deletingIds: [],
      updatingNotes: [],
    });

    expect(rows.map((row) => row.kind)).toEqual(["creating", "saved", "saved"]);
    expect(rows[0]).toEqual({ kind: "creating", ...CREATING_ROW });
  });

  it("deletingIds に含まれる確定行だけ isDeleting になる", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [],
      deletingIds: [OTHER_NOTE.id],
      updatingNotes: [],
    });

    expect(rows).toEqual([savedRow(), savedRow({ note: OTHER_NOTE, isDeleting: true })]);
  });

  it("updatingNotes に含まれる確定行だけ、その更新を pendingUpdate に持つ", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [],
      deletingIds: [],
      updatingNotes: [NOTE_UPDATE],
    });

    expect(rows).toEqual([
      savedRow({ pendingUpdate: NOTE_UPDATE }),
      savedRow({ note: OTHER_NOTE }),
    ]);
  });

  it("同じ行の更新が複数 pending なら、後に始まった更新の値を持つ", () => {
    // useMutationState は古い順に返す (TanStack Query の useMutationState のリファレンスの例)
    const later = { ...NOTE_UPDATE, title: "週末の買い出しリスト" };
    const [row] = toNoteRows({
      notes: [NOTE],
      creatingRows: [],
      deletingIds: [],
      updatingNotes: [NOTE_UPDATE, later],
    });

    expect(row).toMatchObject({ pendingUpdate: { title: later.title } });
  });
});

describe("noteInputOf", () => {
  it("確定行は note を、保存中の行は variables を返す", () => {
    expect(noteInputOf(savedRow())).toBe(NOTE);
    expect(noteInputOf({ kind: "creating", ...CREATING_ROW })).toBe(CREATING_ROW.variables);
  });

  it("更新中の確定行は、再取得前の note ではなく編集後の値を返す", () => {
    expect(noteInputOf(savedRow({ pendingUpdate: NOTE_UPDATE }))).toBe(NOTE_UPDATE);
  });
});

describe("isNoteRowBusy", () => {
  it("保存中の行と、削除中か更新中の確定行だけが busy", () => {
    expect(isNoteRowBusy({ kind: "creating", ...CREATING_ROW })).toBe(true);
    expect(isNoteRowBusy(savedRow({ isDeleting: true }))).toBe(true);
    expect(isNoteRowBusy(savedRow({ pendingUpdate: NOTE_UPDATE }))).toBe(true);
    expect(isNoteRowBusy(savedRow())).toBe(false);
  });
});

describe("getNoteRowId", () => {
  it("確定行と保存中の行で接頭辞が違い、同じ数値でも衝突しない", () => {
    const saved = getNoteRowId(savedRow());
    const creating = getNoteRowId({ kind: "creating", submittedAt: NOTE.id, variables: NOTE });

    expect(saved).toBe("saved-1");
    expect(creating).toBe("creating-1");
    expect(saved).not.toBe(creating);
  });
});
