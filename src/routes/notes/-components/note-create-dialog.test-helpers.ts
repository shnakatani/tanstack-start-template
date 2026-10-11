import { expect, vi } from "vite-plus/test";

import type { Screen } from "@/test/assert/screen-assertions";

import { titleTextbox } from "./note-form.test-helpers";

/** 追加のリンクの可視ラベル。`src/routes/notes/-components/notes-page.tsx` の PageHeader が描く文言を固定する。 */
export const NOTE_CREATE_LINK_LABEL = "＋ メモを追加";

/** 一覧のページの追加のリンク (追加の route を開く) */
export function noteCreateLink(screen: Screen) {
  return screen.getByRole("link", { name: NOTE_CREATE_LINK_LABEL });
}

/** 追加のリンクを押してダイアログを開く。開いた印はタイトル入力の mount を `expect.element` で待つ (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」)。 */
export const openNoteCreateDialog = vi.defineHelper(async (screen: Screen) => {
  await noteCreateLink(screen).click();
  await expect.element(titleTextbox(screen)).toBeInTheDocument();
});
