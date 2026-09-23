import * as v from "valibot";

import { parseEach } from "@/lib/parse-each";

import { noteInputSchema } from "./schema";

/**
 * 追加 mutation の 1 件分。`submittedAt` を併せて絞るのは、同時に走る追加を React の key で
 * 区別するため (保存前の行は id を持たない)。
 */
const creatingRowSchema = v.object({ variables: noteInputSchema, submittedAt: v.number() });

/** 楽観行の 1 件。`submittedAt` が React の key、`variables` が描く内容になる。 */
export type CreatingRow = v.InferOutput<typeof creatingRowSchema>;

/**
 * pending な追加 mutation の状態を一覧の楽観行へ変換する
 * (ADR-0021「テンプレートのメモ画面への適用」)。
 *
 * `mutation.state.variables` の型は `unknown` なので、行に描く前に schema で型へ絞る。
 * NoteInput の形でない値は描けないので `parseEach` が warn を残して除外する。
 */
export function parseCreatingRows(states: readonly unknown[]): CreatingRow[] {
  return parseEach(creatingRowSchema, states, "[parseCreatingRows] variables が NoteInput でない");
}
