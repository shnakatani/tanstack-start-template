/**
 * `vp run db:migrate` の実行口。`drizzle/` の未適用の migration を DB_FILE_NAME の DB へ当てる
 * (`docs/guides/database.md`「スキーマを変える」)。当て方は `migrateDb()` が持つ (ADR-0050)。
 * DB のファイルを作るのはここだけで、アプリの `createDb()` は作らない (`docs/guides/database.md`「DB のファイルをアプリで作らない理由」)
 */
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import { requireEnv } from "@/lib/require-env";
import { createDb, migrateDb } from "@/server/db";

const fileName = requireEnv(
  "DB_FILE_NAME",
  process.env.DB_FILE_NAME,
  "In development, load mise's env (a shell with the mise hook, or `mise x -- vp run <task>`). Elsewhere, set DB_FILE_NAME to an absolute path.",
);

// 新しいクローンには DB のファイルも置き場所の .data/ も無い。better-sqlite3 はディレクトリを作らないので先に作り、
// 空の DB のファイルを作ってから、アプリと同じ createDb() で開く
if (!statSync(fileName, { throwIfNoEntry: false })) {
  mkdirSync(dirname(fileName), { recursive: true });
  new Database(fileName).close();
  console.log(`[db:migrate] ${fileName} を作った`);
}

const db = createDb(fileName);
try {
  migrateDb(db);
  console.log(`[db:migrate] ${fileName} に drizzle/ の migration を当てた`);
} finally {
  db.$client.close();
}
