import { expect } from "vite-plus/test";

import type { Note } from "@/features/notes/schema";
import type { Screen } from "@/test/assert/screen-assertions";

import { rowEditButton } from "./note-cells.test-helpers";
import { titleTextbox } from "./note-form.test-helpers";

/** 行の編集の trigger を押してダイアログを開く。開いた印はタイトル入力に行の値が入ったこと */
export async function openNoteEditDialog(screen: Screen, note: Note) {
  await rowEditButton(screen, note.title).click();
  await expect.element(titleTextbox(screen)).toHaveValue(note.title);
}
