import * as v from "valibot";

import type { NoteInput } from "./schema";
import { noteInputSchema } from "./schema";

/**
 * pending な追加 mutation の `variables` を一覧の楽観行へ変換する
 * (ADR-0016「テンプレートのメモ画面への適用」)。
 *
 * `mutation.state.variables` の型は `unknown` で、`mutationKey` は前方一致で当たるため、
 * 別の mutation の variables も混ざりうる。NoteInput の形でない値は行に描けないので
 * warn を残して除外する。`v.parse` で throw しないのは、呼び出し元が描画中に走り、
 * throw すると一覧ごと Error Boundary へ落ちるため。
 *
 * `key` に `submittedAt` を使うのは、同時に走る追加を React の key で区別するため
 * (保存前の行は id を持たない)。
 */
export function parseCreatingRows(
  states: ReadonlyArray<{ input: unknown; submittedAt: number }>,
): Array<{ key: number; input: NoteInput }> {
  const rows: Array<{ key: number; input: NoteInput }> = [];
  for (const { input: rawInput, submittedAt } of states) {
    const result = v.safeParse(noteInputSchema, rawInput);
    if (result.success) {
      rows.push({ key: submittedAt, input: result.output });
      continue;
    }
    console.warn("[parseCreatingRows] variables が NoteInput でない", { rawInput });
  }
  return rows;
}
