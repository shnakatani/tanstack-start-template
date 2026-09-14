import * as v from "valibot";

import { parseEach } from "@/lib/parse-each";

import type { NoteDeleteTarget } from "./mutations";
import type { Note } from "./schema";
import { noteIdSchema } from "./schema";

/**
 * 削除 mutation の variables の形。完了の文言に対象名が要るので、id だけでなく name も載る。
 * `DeleteTarget` との対応は `parseDeletingIds` 内の `targets` の型注釈が固定する。
 */
const deleteTargetSchema = v.object({ ...noteIdSchema.entries, name: v.string() });

/**
 * pending な削除 mutation の `variables` を削除対象へ絞って id を取り出す
 * (`src/routes/notes/index.tsx` の `useMutationState`)。
 *
 * `mutation.state.variables` の型は `unknown` なので、行の突き合わせに使う前に schema で
 * 型へ絞る。削除対象の形でない値は使えないので `parseEach` が warn を残して除外する。
 */
export function parseDeletingIds(variables: readonly unknown[]): Array<Note["id"]> {
  // 型注釈で DeleteTarget に結ぶ。interface 側に項目が増えたとき、schema の見落としが型エラーで出る
  const targets: NoteDeleteTarget[] = parseEach(
    deleteTargetSchema,
    variables,
    "[parseDeletingIds] variables が削除対象の形でない",
  );
  return targets.map((target) => target.id);
}
