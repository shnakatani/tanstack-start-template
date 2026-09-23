import { expect } from "vite-plus/test";

import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { expectRemoved } from "@/test/absent";
import type { Screen } from "@/test/page-helpers";

/**
 * 追加ダイアログのテスト用 locator。部品のテストとページのテストの両方が同じフォームを操作する
 * ので、ラベルの参照をここに 1 つ置く。書き分けるとラベルの変更で片方だけが落ちる。
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

export function saveButton(screen: Screen) {
  return screen.getByRole("button", { name: "保存", exact: true });
}

/** trigger を押してダイアログを開く。開いた印はタイトル入力の mount を `expect.element` で待つ (docs/guides/testing.md「待つ口を選ぶ」)。 */
export async function openNoteCreateDialog(screen: Screen) {
  await screen.getByRole("button", { name: NOTE_CREATE_TRIGGER_LABEL }).click();
  await expect.element(titleTextbox(screen)).toBeInTheDocument();
}

/** ダイアログが閉じて消えるのを待つ。閉じた印はタイトル入力の unmount (docs/guides/testing.md「待つ口を選ぶ」「否定を肯定で書く」)。 */
export async function expectNoteCreateDialogClosed(screen: Screen) {
  await expectRemoved(titleTextbox(screen));
}
