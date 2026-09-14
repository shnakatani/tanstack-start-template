import type { CreatingRow } from "./creating-rows";
import type { Note } from "./schema";

/** 確定済みの行 (query の data)。`isDeleting` は pending な削除 mutation の variables から派生する */
export type SavedNoteRow = { kind: "saved"; note: Note; isDeleting: boolean };

/** 保存中の行 (pending な追加 mutation の variables)。id と createdAt をまだ持たない */
export type CreatingNoteRow = { kind: "creating" } & CreatingRow;

/**
 * 一覧の 1 行。確定行と保存中の行を 1 本の配列にして table に渡す。楽観表示は query 側
 * (pending な mutation の variables) で行い、`useOptimistic` に query の data を渡さない
 * (ADR-0014「楽観表示の使い分け」、ADR-0016)。
 */
export type NoteRow = SavedNoteRow | CreatingNoteRow;

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
