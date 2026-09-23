import type { Note } from "@/features/notes/schema";
import type { Screen } from "@/test/page-helpers";

/**
 * メモの行。モーダル表示中は行が aria-hidden 配下に入るので、その間に取るときは includeHidden を
 * 渡す。閉じた後は不要 (Base UI の animation は無効で、close の次の描画で unmount する。ADR-0035)。
 */
export function noteRow(screen: Screen, note: Pick<Note, "title">, { includeHidden = false } = {}) {
  return screen.getByRole("row", { name: new RegExp(note.title), includeHidden });
}

/** 行の削除トリガー (`NoteActionsCell`)。アクセシブルネームで行を特定する (確認ダイアログの「削除」と衝突させない)。 */
export function rowDeleteButton(screen: Screen, title: string) {
  return screen.getByRole("button", { name: `${title}を削除`, exact: true });
}
