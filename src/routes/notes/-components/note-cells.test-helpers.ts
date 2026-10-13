import type { Note } from "@/features/notes/schema";
import type { Screen } from "@/test/assert/screen-assertions";

/** 正規表現の特殊文字を escape する (MDN「正規表現」の Escaping) */
function escapeRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * メモの行。モーダル表示中は行が aria-hidden 配下に入るので、その間に取るときは includeHidden を
 * 渡す。閉じた後は不要 (Base UI の animation は無効で、close の次の描画で unmount する。docs/guides/testing/user-interactions.md「animation を無効にして走らせる理由」)。
 * 行の名前は中身を文書順に並べたもので、行を開くボタンの名前もタイトルの cell もタイトルで始まる。名前の先頭で
 * 引き、開いた詳細の行 (名前は本文) に当たらないようにする。本文がタイトルで始まる行を開くと、詳細の行にも当たる
 */
export function noteRow(screen: Screen, note: Pick<Note, "title">, { includeHidden = false } = {}) {
  return screen.getByRole("row", {
    name: new RegExp(`^${escapeRegExp(note.title)}`),
    includeHidden,
  });
}

/** 行を開いて出した詳細の行 (`NoteBodyDetail`)。名前は本文だけなので、本文を含む本体の行は外れる */
export function noteBodyDetailRow(screen: Screen, note: Pick<Note, "body">) {
  return screen.getByRole("row", { name: note.body, exact: true });
}

/** 行を開くボタンの accessible name。一覧の各行に並ぶので、行の見出しで区別する */
export function noteExpandTriggerName(note: Pick<Note, "title">) {
  return `${note.title}の本文を表示`;
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

/** 行の編集リンク (`NoteActionsCell`)。名前は `noteEditTriggerName` から作る。無効のときも Router が role="link" を付ける */
export function rowEditLink(screen: Screen, title: string) {
  return screen.getByRole("link", { name: noteEditTriggerName({ title }) });
}
