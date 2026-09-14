import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import type { Screen } from "@/test/page-helpers";

/**
 * 追加ダイアログのテスト用 locator。部品のテストとページのテストの両方が同じフォームを操作する
 * ので、ラベルの参照をここに 1 つ置く (`.claude/rules/directory-structure.md`「テストとスクリプトの配置」)。
 * 保存ボタンの活性化の仕方 (native click / キーボード) はテストごとに違うので持たない。
 */

/** trigger の可視ラベル。`src/routes/notes/index.tsx` の PageHeader が描く文言を固定する。 */
export const NOTE_CREATE_TRIGGER_LABEL = "＋ メモを追加";

export function titleTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.title, exact: true });
}

export function bodyTextbox(screen: Screen) {
  return screen.getByRole("textbox", { name: NOTE_FIELD_LABELS.body, exact: true });
}

export function saveButton(screen: Screen) {
  return screen.getByRole("button", { name: "保存", exact: true });
}

/** trigger を押してダイアログを開く。開いた印はタイトル入力の mount (ADR-0013 の `findElement()`)。 */
export async function openNoteCreateDialog(screen: Screen) {
  await screen.getByRole("button", { name: NOTE_CREATE_TRIGGER_LABEL }).click();
  await titleTextbox(screen).findElement();
}
