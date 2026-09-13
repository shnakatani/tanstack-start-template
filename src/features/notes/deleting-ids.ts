import * as v from "valibot";

import type { Note } from "./schema";
import { noteIdValueSchema } from "./schema";

/**
 * 削除 mutation の variables の形 (`src/components/delete-confirm-dialog.tsx` の `DeleteTarget`)。
 * 完了の文言に対象名が要るので、id だけでなく name も載る。
 */
const deleteTargetSchema = v.object({ id: noteIdValueSchema, name: v.string() });

/**
 * pending な削除 mutation の `variables` を Note の id へ絞る
 * (`src/routes/notes/index.tsx` の `useMutationState`)。
 *
 * `mutation.state.variables` の型は `unknown` で、`mutationKey` は前方一致で当たるため、
 * 別の mutation の variables も混ざりうる。削除対象の形でない値は行の突き合わせに使えないので
 * warn を残して除外する。`v.parse` で throw しないのは、呼び出し元が描画中に走り、
 * throw すると一覧ごと Error Boundary へ落ちるため。
 */
export function parseDeletingIds(variables: readonly unknown[]): Array<Note["id"]> {
  const ids: Array<Note["id"]> = [];
  for (const rawInput of variables) {
    const result = v.safeParse(deleteTargetSchema, rawInput);
    if (result.success) {
      ids.push(result.output.id);
      continue;
    }
    console.warn("[parseDeletingIds] variables が削除対象の形でない", { rawInput });
  }
  return ids;
}
