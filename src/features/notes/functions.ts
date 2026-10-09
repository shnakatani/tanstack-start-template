import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import {
  createNoteHandler,
  getNoteHandler,
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

export const getNote = createServerFn({ method: "GET" })
  .validator(noteIdSchema)
  .handler(async ({ data }) => {
    const note = await getNoteHandler(data);
    if (note === undefined) {
      // 行が無いことは route の notFoundComponent が受ける
      throw notFound();
    }
    return note;
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
