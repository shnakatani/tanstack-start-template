import type { Note } from "@/features/notes/schema";
import type { Screen } from "@/test/assert/screen-assertions";

/**
 * メモの行。モーダル表示中は行が aria-hidden 配下に入るので、その間に取るときは includeHidden を
 * 渡す。閉じた後は不要 (Base UI の animation は無効で、close の次の描画で unmount する。docs/guides/testing/user-interactions.md「animation を無効にして走らせる理由」)。
 */
export function noteRow(screen: Screen, note: Pick<Note, "title">, { includeHidden = false } = {}) {
  return screen.getByRole("row", { name: new RegExp(note.title), includeHidden });
}

/** 削除の trigger の accessible name。一覧の各行に並ぶので、行の見出しで区別する */
export function noteDeleteTriggerName(note: Pick<Note, "title">) {
  return `${note.title}を削除`;
}

/** 行の削除トリガー (`NoteActionsCell`)。アクセシブルネームで行を特定する (確認ダイアログの「削除」と衝突させない)。 */
export function rowDeleteButton(screen: Screen, title: string) {
  return screen.getByRole("button", { name: noteDeleteTriggerName({ title }) });
}

/** 編集の trigger の accessible name。一覧の各行に並ぶので、行の見出しで区別する */
export function noteEditTriggerName(note: Pick<Note, "title">) {
  return `${note.title}を編集`;
}

/**
 * 行の編集リンク (`NoteActionsCell`)。名前は `noteEditTriggerName` から作る。無効のときも Router が role="link" を付ける。
 * モーダル表示中に取るときは、`noteRow` と同じく includeHidden を渡す
 */
export function rowEditLink(screen: Screen, title: string, { includeHidden = false } = {}) {
  return screen.getByRole("link", { name: noteEditTriggerName({ title }), includeHidden });
}
