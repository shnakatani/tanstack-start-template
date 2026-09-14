import { describe, expect, it } from "vite-plus/test";

import { getNoteRowId, noteInputOf, toNoteRows } from "./note-rows";
import { NOTE, OTHER_NOTE } from "./note.test-helpers";

const CREATING = { submittedAt: 1_700_000_000_000, variables: { title: "新しいメモ", body: "" } };

describe("toNoteRows", () => {
  it("入力が全て空なら空配列", () => {
    expect(toNoteRows({ notes: [], creatingRows: [], deletingIds: [] })).toEqual([]);
  });

  it("保存中の行を先頭に、確定行をその後ろに並べる", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [CREATING],
      deletingIds: [],
    });

    expect(rows.map((row) => row.kind)).toEqual(["creating", "saved", "saved"]);
    expect(rows[0]).toEqual({ kind: "creating", ...CREATING });
  });

  it("deletingIds に含まれる確定行だけ isDeleting になる", () => {
    const rows = toNoteRows({
      notes: [NOTE, OTHER_NOTE],
      creatingRows: [],
      deletingIds: [OTHER_NOTE.id],
    });

    expect(rows).toEqual([
      { kind: "saved", note: NOTE, isDeleting: false },
      { kind: "saved", note: OTHER_NOTE, isDeleting: true },
    ]);
  });
});

describe("noteInputOf", () => {
  it("確定行は note を、保存中の行は variables を返す", () => {
    expect(noteInputOf({ kind: "saved", note: NOTE, isDeleting: false })).toBe(NOTE);
    expect(noteInputOf({ kind: "creating", ...CREATING })).toBe(CREATING.variables);
  });
});

describe("getNoteRowId", () => {
  it("確定行と保存中の行で接頭辞が違い、同じ数値でも衝突しない", () => {
    const saved = getNoteRowId({ kind: "saved", note: NOTE, isDeleting: false });
    const creating = getNoteRowId({ kind: "creating", submittedAt: NOTE.id, variables: NOTE });

    expect(saved).toBe("saved-1");
    expect(creating).toBe("creating-1");
    expect(saved).not.toBe(creating);
  });
});
