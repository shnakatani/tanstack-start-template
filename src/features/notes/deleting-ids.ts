import * as v from "valibot";

import type { Note } from "./schema";
import { noteIdValueSchema } from "./schema";

/**
 * pending な削除 mutation の `variables` を Note の id へ絞る
 * (`src/routes/notes/index.tsx` の `useMutationState`)。
 *
 * `mutation.state.variables` の型は `unknown` で、`mutationKey` は前方一致で当たるため、
 * 別の mutation の variables も混ざりうる。id でない値は行の突き合わせに使えないので
 * warn を残して除外する。`v.parse` で throw しないのは、呼び出し元が描画中に走り、
 * throw すると一覧ごと Error Boundary へ落ちるため。
 */
export function parseDeletingIds(variables: readonly unknown[]): Array<Note["id"]> {
  const ids: Array<Note["id"]> = [];
  for (const rawInput of variables) {
    const result = v.safeParse(noteIdValueSchema, rawInput);
    if (result.success) {
      ids.push(result.output);
      continue;
    }
    console.warn("[parseDeletingIds] variables が Note の id でない", { rawInput });
  }
  return ids;
}
