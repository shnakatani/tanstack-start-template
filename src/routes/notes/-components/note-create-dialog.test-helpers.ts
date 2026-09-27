import { expect } from "vite-plus/test";

import type { Note } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { expectRemoved } from "@/test/assert/absent";
import type { Screen } from "@/test/assert/screen-assertions";

/**
 * メモのフォーム (`note-form.tsx`) を操作するテスト用 locator。追加と編集のダイアログは同じフォームを
 * 描き、部品のテストとページのテストの両方がそれを操作するので、ラベルの参照をここに 1 つ置く。
 * 書き分けるとラベルの変更で片方だけが落ちる。trigger と開く操作は追加と編集で分けて持つ。
 * 保存の確定は持たない。ページのテストは確定後に実マウスの退避 (`parkMouse`) が要り、部品のテストは要らない。
 */

/** trigger の可視ラベル。`src/routes/notes/index.tsx` の PageHeader が描く文言を固定する。 */
export const NOTE_CREATE_TRIGGER_LABEL = "＋ メモを追加";

export function titleTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.title, exact: true });
}

export function bodyTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.body, exact: true });
}

/** 期日のトリガー。名前はラベルと表示中の値をつないだもの (form-fields.tsx の FormDateField) なので、ラベルと空白の前方一致で取る */
export function dueDateTrigger(screen: Screen) {
  return screen.getByRole("button", { name: new RegExp(`^${NOTE_FIELD_LABELS.dueDate} `) });
}

export function saveButton(screen: Screen) {
  return screen.getByRole("button", { name: "保存", exact: true });
}

/** trigger を押してダイアログを開く。開いた印はタイトル入力の mount を `expect.element` で待つ (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」)。 */
export async function openNoteCreateDialog(screen: Screen) {
  await screen.getByRole("button", { name: NOTE_CREATE_TRIGGER_LABEL }).click();
  await expect.element(titleTextbox(screen)).toBeInTheDocument();
}

/** 編集の trigger の accessible name。一覧の各行に並ぶので、行の見出しで区別する */
export function noteEditTriggerName(note: Note) {
  return `${note.title}を編集`;
}

/** 行の編集の trigger を押してダイアログを開く。開いた印はタイトル入力に行の値が入ったこと */
export async function openNoteEditDialog(screen: Screen, note: Note) {
  await screen.getByRole("button", { name: noteEditTriggerName(note), exact: true }).click();
  await expect.element(titleTextbox(screen)).toHaveValue(note.title);
}

/** 追加か編集のダイアログが閉じて消えるのを待つ。閉じた印はタイトル入力の unmount (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」「否定を肯定で書く」)。 */
export async function expectNoteDialogClosed(screen: Screen) {
  await expectRemoved(titleTextbox(screen));
}
