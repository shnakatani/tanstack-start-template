import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { requireEnv } from "@/lib/require-env";
import * as schema from "@/server/db/schema";

const MIGRATIONS_FOLDER = "drizzle";

/**
 * 相対パスの基準にするプロジェクトルートを、起点から上へ package.json を探して決める。
 * 見つからなければ起点をそのまま返す (fail-safe) が、基準がずれた原因を追えるよう warn を残す。
 *
 * @param from 探索の起点ディレクトリ
 */
export function findProjectRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(resolve(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      console.warn("[db] package.json が見つからず、相対パスを起点ディレクトリ基準で解決します", {
        from,
      });
      return from;
    }
    dir = parent;
  }
}

/**
 * 相対パスをプロジェクトルート基準へ揃える。
 * cwd 基準のままだと、サブディレクトリから起動したときに DB_FILE_NAME と migration フォルダが
 * 別の場所を指す。DB 側は「migration 未適用の空 DB を黙って作る」形で、migration 側は
 * "Can't find meta/_journal.json file" で現れる (前者は失敗とすら見えない)。
 * 基準は drizzle.config.ts と同じくリポジトリルート。
 */
function resolveFromProjectRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(findProjectRoot(process.cwd()), path);
}

function requireDbFileName(): string {
  // fail-closed: 未設定のまま better-sqlite3 に渡すと既定のカレントディレクトリ相対パスへ
  // silent に接続しかねない。呼び出し側に明示させる
  return requireEnv(
    "DB_FILE_NAME",
    process.env.DB_FILE_NAME,
    "Configure it in .mise.toml [env], or pass a path / ':memory:' explicitly to createDb().",
  );
}

function ensureDirectoryExists(fileName: string): void {
  if (fileName === ":memory:") {
    return;
  }
  mkdirSync(dirname(fileName), { recursive: true });
}

/**
 * DB へ接続する。fileName を省略すると DB_FILE_NAME 環境変数を使う (未設定は throw)。
 * 相対パスはプロジェクトルート基準で解決する。テストからは ":memory:" を引数で渡す。
 */
export function createDb(fileName: string = requireDbFileName()) {
  const resolved = fileName === ":memory:" ? fileName : resolveFromProjectRoot(fileName);
  ensureDirectoryExists(resolved);
  const sqlite = new Database(resolved);
  return drizzle(sqlite, { schema });
}

/** migration を適用する (drizzle/ 配下の生成 SQL を対象に実行)。 */
export function migrateDb(db: ReturnType<typeof createDb>): void {
  migrate(db, { migrationsFolder: resolveFromProjectRoot(MIGRATIONS_FOLDER) });
}
