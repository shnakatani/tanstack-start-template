import type { CreatingRow } from "@/features/notes/creating-rows";
import type { Note, NoteInput } from "@/features/notes/schema";

/** 確定済みの行 (query の data)。`isDeleting` は pending な削除 mutation の variables から派生する */
type SavedNoteRow = { kind: "saved"; note: Note; isDeleting: boolean };

/** 保存中の行 (pending な追加 mutation の variables)。id と createdAt をまだ持たない */
type CreatingNoteRow = { kind: "creating" } & CreatingRow;

/** 一覧の 1 行。確定行と保存中の行の union で、cell は `kind` で分岐する (ADR-0019「行の型」)。 */
export type NoteRow = SavedNoteRow | CreatingNoteRow;

/** busy 表現 (aria-busy + 半透明) を付ける行。保存中の行と、削除中の確定行 (ADR-0016) */
export function isNoteRowBusy(row: NoteRow): boolean {
  return row.kind === "creating" || row.isDeleting;
}

/** 入力項目 (title / body) がどちらの行にも載っている場所。テキスト列はここから読む */
export function noteInputOf(row: NoteRow): NoteInput {
  return row.kind === "saved" ? row.note : row.variables;
}

/** 行の React key と table の row id。確定行と保存中の行は別の行で、再取得で入れ替わる */
export function getNoteRowId(row: NoteRow): string {
  return row.kind === "saved" ? `saved-${row.note.id}` : `creating-${row.submittedAt}`;
}

/**
 * 一覧の行を組み立てる。保存中の行を先頭に置き (一覧は createdAt の降順)、確定行には削除中か
 * どうかを付ける。再取得完了で保存中の行は実データに置き換わる (ADR-0016)。
 */
export function toNoteRows({
  notes,
  creatingRows,
  deletingIds,
}: {
  notes: readonly Note[];
  creatingRows: readonly CreatingRow[];
  deletingIds: ReadonlyArray<Note["id"]>;
}): NoteRow[] {
  return [
    ...creatingRows.map((row): CreatingNoteRow => ({ kind: "creating", ...row })),
    ...notes.map((note): SavedNoteRow => ({
      kind: "saved",
      note,
      isDeleting: deletingIds.includes(note.id),
    })),
  ];
}
