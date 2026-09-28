import { createServerFn } from "@tanstack/react-start";

import {
  createNoteHandler,
  listNotesHandler,
  removeNoteHandler,
  updateNoteHandler,
} from "./handlers.server";
import { noteIdSchema, noteInputSchema, noteListFilterSchema, noteUpdateSchema } from "./schema";

// 実処理は handlers.server.ts が持つ。ここは境界 (HTTP メソッドと入力検証) の宣言だけを置き、
// ロジックは server function を経由せず単体テストできる側に残す。

export const listNotes = createServerFn({ method: "GET" })
  .validator(noteListFilterSchema)
  .handler(async ({ data }) => {
    return listNotesHandler(data);
  });

export const createNote = createServerFn({ method: "POST" })
  .validator(noteInputSchema)
  .handler(async ({ data }) => {
    return createNoteHandler(data);
  });

export const updateNote = createServerFn({ method: "POST" })
  .validator(noteUpdateSchema)
  .handler(async ({ data }) => {
    return updateNoteHandler(data);
  });

export const removeNote = createServerFn({ method: "POST" })
  .validator(noteIdSchema)
  .handler(async ({ data }) => {
    return removeNoteHandler(data);
  });
