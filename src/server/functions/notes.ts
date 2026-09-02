import { createServerFn } from "@tanstack/react-start";

import { noteIdSchema, noteInputSchema } from "@/lib/notes-schema";
import {
  createNoteHandler,
  listNotesHandler,
  removeNoteHandler,
} from "@/server/functions/notes.server";

// 実処理は notes.server.ts が持つ。ここは境界 (HTTP メソッドと入力検証) の宣言だけを置き、
// ロジックは server function を経由せず単体テストできる側に残す。

export const listNotes = createServerFn({ method: "GET" }).handler(async () => {
  return listNotesHandler();
});

export const createNote = createServerFn({ method: "POST" })
  .validator(noteInputSchema)
  .handler(async ({ data }) => {
    return createNoteHandler(data);
  });

export const removeNote = createServerFn({ method: "POST" })
  .validator(noteIdSchema)
  .handler(async ({ data }) => {
    return removeNoteHandler(data);
  });
