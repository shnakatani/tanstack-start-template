import { describe, expect, it } from "vite-plus/test";

import { getNoteRowId, toNoteRows } from "./note-rows";
import type { Note } from "./schema";

const NOTE: Note = {
  id: 1,
  title: "買い物リスト",
  body: "牛乳とパンを買う",
  createdAt: new Date("2026-08-17T00:30:00.000Z"),
};
const OTHER: Note = { ...NOTE, id: 2, title: "読書メモ" };
const CREATING = { submittedAt: 1_700_000_000_000, variables: { title: "新しいメモ", body: "" } };

describe("toNoteRows", () => {
  it("入力が全て空なら空配列", () => {
    expect(toNoteRows({ notes: [], creatingRows: [], deletingIds: [] })).toEqual([]);
  });

  it("保存中の行を先頭に、確定行をその後ろに並べる", () => {
    const rows = toNoteRows({ notes: [NOTE, OTHER], creatingRows: [CREATING], deletingIds: [] });

    expect(rows.map((row) => row.kind)).toEqual(["creating", "saved", "saved"]);
    expect(rows[0]).toEqual({ kind: "creating", ...CREATING });
  });

  it("deletingIds に含まれる確定行だけ isDeleting になる", () => {
    const rows = toNoteRows({ notes: [NOTE, OTHER], creatingRows: [], deletingIds: [OTHER.id] });

    expect(rows).toEqual([
      { kind: "saved", note: NOTE, isDeleting: false },
      { kind: "saved", note: OTHER, isDeleting: true },
    ]);
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
