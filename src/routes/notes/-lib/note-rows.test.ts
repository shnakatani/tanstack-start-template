import { describe, expect, it } from "vite-plus/test";

import { CREATING_ROW, NOTE, OTHER_NOTE, UPDATED_NOTE } from "@/features/notes/schema.test-helpers";

import { getNoteRowId, isNoteRowBusy, noteInputOf, toNoteRows } from "./note-rows";

/** NOTE を UPDATED_NOTE へ書き換える更新 (pending な更新 mutation の variables を絞った形) */
const { title, body, dueDate } = UPDATED_NOTE;
const NOTE_UPDATE_INPUT = { title, body, dueDate };
const NOTE_UPDATE = { id: UPDATED_NOTE.id, ...NOTE_UPDATE_INPUT };

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

    expect(rows).toEqual([
      { kind: "saved", note: NOTE, isDeleting: false, pendingUpdate: null },
      { kind: "saved", note: OTHER_NOTE, isDeleting: true, pendingUpdate: null },
    ]);
  });

  it("updatingNotes に含まれる確定行だけ、id を除いた入力項目を pendingUpdate に持つ", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [],
      deletingIds: [],
      updatingNotes: [NOTE_UPDATE],
    });

    expect(rows).toEqual([
      { kind: "saved", note: NOTE, isDeleting: false, pendingUpdate: NOTE_UPDATE_INPUT },
      { kind: "saved", note: OTHER_NOTE, isDeleting: false, pendingUpdate: null },
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
    expect(noteInputOf({ kind: "saved", note: NOTE, isDeleting: false, pendingUpdate: null })).toBe(
      NOTE,
    );
    expect(noteInputOf({ kind: "creating", ...CREATING_ROW })).toBe(CREATING_ROW.variables);
  });

  it("更新中の確定行は、再取得前の note ではなく編集後の値を返す", () => {
    expect(
      noteInputOf({
        kind: "saved",
        note: NOTE,
        isDeleting: false,
        pendingUpdate: NOTE_UPDATE_INPUT,
      }),
    ).toBe(NOTE_UPDATE_INPUT);
  });
});

describe("isNoteRowBusy", () => {
  it("保存中の行と、削除中か更新中の確定行だけが busy", () => {
    expect(isNoteRowBusy({ kind: "creating", ...CREATING_ROW })).toBe(true);
    expect(
      isNoteRowBusy({ kind: "saved", note: NOTE, isDeleting: true, pendingUpdate: null }),
    ).toBe(true);
    expect(
      isNoteRowBusy({
        kind: "saved",
        note: NOTE,
        isDeleting: false,
        pendingUpdate: NOTE_UPDATE_INPUT,
      }),
    ).toBe(true);
    expect(
      isNoteRowBusy({ kind: "saved", note: NOTE, isDeleting: false, pendingUpdate: null }),
    ).toBe(false);
  });
});

describe("getNoteRowId", () => {
  it("確定行と保存中の行で接頭辞が違い、同じ数値でも衝突しない", () => {
    const saved = getNoteRowId({
      kind: "saved",
      note: NOTE,
      isDeleting: false,
      pendingUpdate: null,
    });
    const creating = getNoteRowId({ kind: "creating", submittedAt: NOTE.id, variables: NOTE });

    expect(saved).toBe("saved-1");
    expect(creating).toBe("creating-1");
    expect(saved).not.toBe(creating);
  });
});
