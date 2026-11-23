import { statSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { MigrationMeta } from "drizzle-orm/migrator";

import { requireEnv } from "@/lib/require-env";
import * as schema from "@/server/db/schema";

import { MIGRATIONS_FOLDER } from "./migrations-folder";

function requireDbFileName(): string {
  // fail-closed: 未設定のまま better-sqlite3 に渡すと既定のカレントディレクトリ相対パスへ
  // silent に接続しかねない。呼び出し側に明示させる
  return requireEnv(
    "DB_FILE_NAME",
    process.env.DB_FILE_NAME,
    "In development, load mise's env (`mise run serve`, a shell with the mise hook, or `mise x -- vp run <task>`). Elsewhere, set DB_FILE_NAME to an absolute path, or pass a path / ':memory:' explicitly to createDb().",
  );
}

/**
 * DB へ接続する。fileName を省略すると DB_FILE_NAME 環境変数を使う (未設定は throw)。
 * 相対パスは drizzle-kit と同じく cwd を基準に解決する。DB のファイルは作らない (`vp run db:migrate` が作る)。
 * テストからは ":memory:" を引数で渡す。
 */
export function createDb(fileName: string = requireDbFileName()) {
  // アプリは migration を当てないので、無い DB を作ると最初のクエリが no such table で落ちるだけになる。
  // fileMustExist が作らずに落とすが、その文言は開こうとしたパスを含まず、ディレクトリを指しても
  // existsSync は真を返す。先にファイルかを見て、開こうとしたパスを文言に入れて落とす。
  // 例外はここで catch せず、server のログに残す口に任せる (ADR-0038)
  if (fileName !== ":memory:" && !statSync(fileName, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(
      `[db] DB のファイルが無い (${resolve(fileName)})。vp run db:migrate で作るか、DB_FILE_NAME を確かめる`,
    );
  }
  const sqlite = new Database(fileName, { fileMustExist: true });
  // SQLite は外部キーの検査の既定を約束しないので、接続ごとに有効にする (docs/guides/database.md「外部キーの検査を接続で有効にする理由」)
  sqlite.pragma("foreign_keys = ON");
  // SQLITE_OMIT_TRIGGER でビルドした SQLite ではこの PRAGMA が何もせず、エラーも返さないので、効いたかを確かめる
  if (sqlite.pragma("foreign_keys", { simple: true }) !== 1) {
    sqlite.close();
    throw new Error(
      `[db] 外部キーの検査を有効にできない (${fileName})。外部キーを検査できる構成でビルドした SQLite を使う`,
    );
  }
  return drizzle(sqlite, { schema });
}

type Db = ReturnType<typeof createDb>;

/** 適用済みの migration の記録の表。drizzle-orm の migrator の既定の名前と形にそろえる */
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * `drizzle/` の migration のうち未適用のものを当てる。SQLite「ALTER TABLE」の 12 の手順の外枠の形で当てる
 * (ADR-0050): トランザクションの外で外部キーの検査を切り、1 つのトランザクションで未適用の migration を
 * 順に流して記録し、`PRAGMA foreign_key_check` の違反が当てる前より増えていれば戻して落とし、増えていなければ
 * 確定して検査を戻す。テーブルの作り直しの中身 (作る・写す・消す・改名する) は drizzle-kit が書き出す SQL が持つ。
 * drizzle-orm の migrator はトランザクションの中で `PRAGMA foreign_keys=OFF` を流すので効かず、
 * 子から参照される親を作り直すと、`DROP TABLE` が外部キーの検査で落ちるか、`ON DELETE` の動作で子の行を消す
 */
export function migrateDb(db: Db, migrationsFolder: string = MIGRATIONS_FOLDER): void {
  const migrations = readMigrationFiles({ migrationsFolder });
  withForeignKeysOff(db, () => {
    applyPendingMigrations(db, migrations);
  });
}

function withForeignKeysOff(db: Db, run: () => void): void {
  const sqlite = db.$client;
  // トランザクションの中ではこの PRAGMA が何もせず、エラーも返さないので、効いたかを確かめる
  // (SQLite「SQLite Foreign Key Support」の「Enabling Foreign Key Support」)
  sqlite.pragma("foreign_keys = OFF");
  try {
    if (sqlite.pragma("foreign_keys", { simple: true }) !== 0) {
      throw new Error(
        "[db] migration の前に外部キーの検査を切れない。開いているトランザクションの外で migrateDb() を呼ぶ",
      );
    }
    run();
  } catch (error) {
    restoreForeignKeys(db, error);
    throw error;
  }
  restoreForeignKeys(db);
}

/** 外部キーの検査を戻す。migration の失敗 (`failure`) の後に戻せなかったときも、その失敗を cause に残す */
function restoreForeignKeys(db: Db, failure?: unknown): void {
  const sqlite = db.$client;
  let enabled: unknown;
  let restoreError: unknown;
  try {
    sqlite.pragma("foreign_keys = ON");
    enabled = sqlite.pragma("foreign_keys", { simple: true });
  } catch (error) {
    restoreError = error;
  }
  if (enabled !== 1) {
    const detail =
      restoreError instanceof Error ? restoreError.message : `値が ${JSON.stringify(enabled)}`;
    throw new Error(
      `[db] migration の後に外部キーの検査を戻せない (${sqlite.name}、${detail})。この接続を使わずに閉じる`,
      { cause: failure ?? restoreError },
    );
  }
}

/** `PRAGMA foreign_key_check` の違反の行 (表、rowid、親の表、外部キーの番号) を比べられる文字列にして読む */
function readForeignKeyViolations(db: Db): string[] {
  const rows = db.$client.pragma("foreign_key_check");
  if (!Array.isArray(rows)) {
    throw new TypeError(`[db] PRAGMA foreign_key_check が配列を返さない: ${typeof rows}`);
  }
  return rows.map((row) => JSON.stringify(row));
}

/**
 * 記録の表の形、最後に適用した migration の判定、記録の書き方は、drizzle-orm 0.45.4 の migrator
 * (`SQLiteSyncDialect.migrate`) と同じにする。drizzle-kit migrate で当てた DB の記録をそのまま引き継ぎ、
 * この関数が書いた記録も drizzle-orm の migrator が適用済みとみなす。
 * drizzle-orm の migrator と違い、記録の表の作成と最後の記録の読み出しも書き込みのロックを取った
 * トランザクション (`BEGIN IMMEDIATE`) の中で行う。2 つの接続が同時に当てても、後の側は先の側の確定を待ち、
 * その記録を読んでから未適用を決める
 */
function applyPendingMigrations(db: Db, migrations: MigrationMeta[]): void {
  db.$client
    .transaction(() => {
      db.run(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATIONS_TABLE)} (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric
        )
      `);
      const last = db.get<{ created_at: unknown } | undefined>(
        sql`SELECT created_at FROM ${sql.identifier(MIGRATIONS_TABLE)} ORDER BY created_at DESC LIMIT 1`,
      );
      const pending = migrations.filter(
        ({ folderMillis }) => last === undefined || Number(last.created_at) < folderMillis,
      );
      if (pending.length === 0) {
        return;
      }

      // SQLite の手順は、スキーマの変更が外部キーを壊していないことを確かめる。当てる前からある違反では止めず、
      // migration が増やした違反だけで戻す (Atlas の `OpenTx` と同じ)
      const before = new Set(readForeignKeyViolations(db));
      for (const migration of pending) {
        for (const statement of migration.sql) {
          db.run(sql.raw(statement));
        }
        db.run(
          sql`INSERT INTO ${sql.identifier(MIGRATIONS_TABLE)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
        );
      }
      // 行の値は文言に入れず、表と rowid だけを出す
      const added = readForeignKeyViolations(db).filter((violation) => !before.has(violation));
      if (added.length > 0) {
        throw new Error(
          `[db] migration が外部キーの違反を増やすので、適用せずに戻した: [${added.join(",")}]`,
        );
      }
    })
    .immediate();
}
