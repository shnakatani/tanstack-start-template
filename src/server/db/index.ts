import { existsSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { requireEnv } from "@/lib/require-env";
import * as schema from "@/server/db/schema";

// 相対パスは cwd を基準に解決される。drizzle.config.ts の `out` と同じ場所を指す
const MIGRATIONS_FOLDER = "./drizzle";

function requireDbFileName(): string {
  // fail-closed: 未設定のまま better-sqlite3 に渡すと既定のカレントディレクトリ相対パスへ
  // silent に接続しかねない。呼び出し側に明示させる
  return requireEnv(
    "DB_FILE_NAME",
    process.env.DB_FILE_NAME,
    "Configure it in .mise.toml [env], or pass a path / ':memory:' explicitly to createDb().",
  );
}

/**
 * DB へ接続する。fileName を省略すると DB_FILE_NAME 環境変数を使う (未設定は throw)。
 * 相対パスは drizzle-kit と同じく cwd を基準に解決する。DB のファイルは作らない (`mise run db:migrate` が作る)。
 * テストからは ":memory:" を引数で渡す。
 */
export function createDb(fileName: string = requireDbFileName()) {
  // アプリは migration を当てないので、無い DB を作ると最初のクエリが no such table で落ちるだけになる。
  // fileMustExist が作らずに落とすが、その文言は開こうとしたパスを含まないので、先にパスと作り方を示す
  if (fileName !== ":memory:" && !existsSync(fileName)) {
    throw new Error(
      `[db] DB のファイルが無い: ${resolve(fileName)}。mise run db:migrate で作るか、DB_FILE_NAME を確かめる`,
    );
  }
  const sqlite = new Database(fileName, { fileMustExist: true });
  return drizzle(sqlite, { schema });
}

/** migration を適用する (drizzle/ 配下の生成 SQL を対象に実行)。 */
export function migrateDb(db: ReturnType<typeof createDb>): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
