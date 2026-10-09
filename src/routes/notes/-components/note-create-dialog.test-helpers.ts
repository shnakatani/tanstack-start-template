import { expect, vi } from "vite-plus/test";

import type { Screen } from "@/test/assert/screen-assertions";

import { titleTextbox } from "./note-form.test-helpers";

/** trigger の可視ラベル。`src/routes/notes/-components/notes-page.tsx` の PageHeader が描く文言を固定する。 */
export const NOTE_CREATE_TRIGGER_LABEL = "＋ メモを追加";

/** trigger を押してダイアログを開く。開いた印はタイトル入力の mount を `expect.element` で待つ (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」)。 */
export const openNoteCreateDialog = vi.defineHelper(async (screen: Screen) => {
  await screen.getByRole("button", { name: NOTE_CREATE_TRIGGER_LABEL }).click();
  await expect.element(titleTextbox(screen)).toBeInTheDocument();
});
