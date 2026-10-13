import type { createDb } from "@/server/db";

import { seedNotes } from "./notes-seed.ts";

type Db = ReturnType<typeof createDb>;

/** ドメインの入れ方が受け取るトランザクション。`createDb()` の `transaction` の callback の引数の型 */
export type SeedTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface SeededTable {
  readonly table: string;
  readonly rows: number;
}

/** 見本を持つドメインの入れ方を 1 つのトランザクションで呼ぶ。どれかが落ちたら、どのテーブルも入れ直す前に戻る */
export function seedAll(db: Db): SeededTable[] {
  return db.transaction((tx) => [seedNotes(tx)]);
}
