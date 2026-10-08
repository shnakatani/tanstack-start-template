import type { CreatingRow } from "@/features/notes/creating-rows";
import type { Note, NoteInput, NoteUpdate } from "@/features/notes/schema";

/**
 * 確定済みの行 (query の data)。`isDeleting` と `pendingUpdate` は pending な削除・更新 mutation の
 * variables から派生する
 */
type SavedNoteRow = {
  kind: "saved";
  note: Note;
  isDeleting: boolean;
  /** 更新中なら編集後の値 (pending な更新 mutation の variables)。再取得完了で null に戻る */
  pendingUpdate: NoteUpdate | null;
};

/** 保存中の行 (pending な追加 mutation の variables)。id と createdAt をまだ持たない */
type CreatingNoteRow = { kind: "creating" } & CreatingRow;

/** 一覧の 1 行。確定行と保存中の行の union で、cell は `kind` で分岐する (`docs/guides/lists-and-search.md`「一覧テーブルを組む」の行の型の行)。 */
export type NoteRow = SavedNoteRow | CreatingNoteRow;

/** busy 表現 (半透明) を付ける行。保存中の行と、削除中か更新中の確定行 (ADR-0017) */
export function isNoteRowBusy(row: NoteRow): boolean {
  return row.kind === "creating" || row.isDeleting || row.pendingUpdate !== null;
}

/**
 * 入力項目 (NoteInput) がどちらの行にも載っている場所。テキスト列はここから読む。更新中の確定行は
 * 再取得前の note ではなく編集後の値を返す
 */
export function noteInputOf(row: NoteRow): NoteInput {
  if (row.kind === "creating") {
    return row.variables;
  }
  return row.pendingUpdate ?? row.note;
}

/** 行の React key と table の row id。確定行と保存中の行は別の行で、再取得で入れ替わる */
export function getNoteRowId(row: NoteRow): string {
  return row.kind === "saved" ? `saved-${row.note.id}` : `creating-${row.submittedAt}`;
}

/**
 * 一覧の行を組み立てる。保存中の行を先頭に置き (一覧は createdAt の降順)、確定行には削除中か
 * どうかと、更新中なら編集後の値を付ける。再取得完了で保存中の行は実データに置き換わり、
 * 更新中の行は実データの値に戻る (ADR-0017)。
 */
export function toNoteRows({
  notes,
  creatingRows,
  deletingIds,
  updatingNotes,
}: {
  notes: readonly Note[];
  creatingRows: readonly CreatingRow[];
  deletingIds: ReadonlyArray<Note["id"]>;
  updatingNotes: readonly NoteUpdate[];
}): NoteRow[] {
  return [
    ...creatingRows.map((row): CreatingNoteRow => ({ kind: "creating", ...row })),
    ...notes.map((note): SavedNoteRow => {
      // useMutationState は古い順に返す (TanStack Query の useMutationState のリファレンスが、
      // 最後の要素を最新の呼び出しとして読む例を載せている)。今の画面は更新中の行の編集を止めるので
      // 同じ行の更新は重ならないが、重なったときは後に始まった更新を採る
      const update = updatingNotes.findLast((candidate) => candidate.id === note.id);
      return {
        kind: "saved",
        note,
        isDeleting: deletingIds.includes(note.id),
        pendingUpdate: update ?? null,
      };
    }),
  ];
}
