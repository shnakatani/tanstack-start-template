import { parseEach } from "@/lib/parse-each";

import type { NoteUpdate } from "./schema";
import { noteUpdateSchema } from "./schema";

/**
 * pending な更新 mutation の `variables` を更新の形 (`NoteUpdate`) へ絞る
 * (`src/routes/notes/-components/notes-page.tsx` の `useMutationState`)。
 *
 * `mutation.state.variables` の型は `unknown` なので、行の突き合わせに使う前に schema で
 * 型へ絞る。更新の形でない値は使えないので `parseEach` が warn を残して除外する。
 */
export function parseUpdatingNotes(variables: readonly unknown[]): NoteUpdate[] {
  return parseEach(noteUpdateSchema, variables, "[parseUpdatingNotes] variables が更新の形でない");
}
