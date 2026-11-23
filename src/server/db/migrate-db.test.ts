import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it, vi } from "vite-plus/test";

import { createDb, migrateDb } from "./index";

type OnDelete = "no action" | "cascade" | "set null";

/** 親 (authors) と、親を参照する子 (books) を作る migration。drizzle-kit 0.31.11 の generate が出力する形 */
function createTables(onDelete: OnDelete): string {
  return `CREATE TABLE \`authors\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`name\` text
);
--> statement-breakpoint
CREATE TABLE \`books\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`title\` text,
	\`author_id\` integer,
	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE ${onDelete}
);
`;
}

/**
 * 親の name を NOT NULL にする migration。drizzle-kit 0.31.11 の generate は、SQLite で列の制約を変えると
 * テーブルを作り直す SQL を出力する。`copyWhere` を渡すと、コピーで親の行を落として子の参照を切る
 */
function rebuildAuthors(copyWhere = ""): string {
  return `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_authors\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`name\` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO \`__new_authors\`("id", "name") SELECT "id", "name" FROM \`authors\`${copyWhere};--> statement-breakpoint
DROP TABLE \`authors\`;--> statement-breakpoint
ALTER TABLE \`__new_authors\` RENAME TO \`authors\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;`;
}

/** drizzle-kit が書き出す形 (`meta/_journal.json` と `<tag>.sql`) で migration をフォルダに書く */
function writeMigrations(folder: string, sqls: string[]): void {
  mkdirSync(join(folder, "meta"), { recursive: true });
  const entries = sqls.map((sql, idx) => {
    const tag = `000${idx}_test`;
    writeFileSync(join(folder, `${tag}.sql`), sql);
    return { idx, version: "6", when: 1_700_000_000_000 + idx, tag, breakpoints: true };
  });
  writeFileSync(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries }),
  );
}

/** 親 2 行と、親 1 を指す子 2 行、親 2 を指す子 1 行を入れた DB を返す。テーブルは 1 本目の migration で作る */
function createDbWithRows(folder: string, onDelete: OnDelete) {
  writeMigrations(folder, [createTables(onDelete)]);
  const db = createDb(":memory:");
  migrateDb(db, folder);
  db.$client.exec(`
    insert into authors (id, name) values (1, 'a'), (2, 'b');
    insert into books (id, title, author_id) values (1, 'x', 1), (2, 'y', 1), (3, 'z', 2);
  `);
  return db;
}

/** 外部キーの検査を切って、どの親も指さない子の行 (rowid 4) を入れる。当てる前からある違反を作る */
function insertOrphanBook(db: ReturnType<typeof createDb>): void {
  db.$client.pragma("foreign_keys = OFF");
  db.$client.exec("insert into books (id, title, author_id) values (4, 'orphan', 9)");
  db.$client.pragma("foreign_keys = ON");
}

/** 別のテーブルを足すだけの migration。外部キーの違反を作らない */
const CREATE_PUBLISHERS = `CREATE TABLE \`publishers\` (
	\`id\` integer PRIMARY KEY NOT NULL
);
`;

function readBooks(db: ReturnType<typeof createDb>): unknown[] {
  return db.$client.prepare("select id, author_id from books order by id").all();
}

function readMigrationRecords(db: ReturnType<typeof createDb>): unknown[] {
  return db.$client
    .prepare('select hash, created_at from "__drizzle_migrations" order by created_at')
    .all();
}

const BOOKS = [
  { id: 1, author_id: 1 },
  { id: 2, author_id: 1 },
  { id: 3, author_id: 2 },
];

describe("migrateDb", () => {
  // 子に行がある DB で親を作り直す。行の無い DB では、外部キーの検査が効いたままでも落ちず、行も消えない
  it.each<OnDelete>(["no action", "cascade", "set null"])(
    "子から参照される親を作り直しても、子の行と参照が残る (ON DELETE %s)",
    (onDelete) => {
      using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
      const db = createDbWithRows(dir.path, onDelete);
      writeMigrations(dir.path, [createTables(onDelete), rebuildAuthors()]);

      migrateDb(db, dir.path);

      expect(readBooks(db)).toEqual(BOOKS);
      expect(db.$client.prepare("select count(*) as n from authors").get()).toEqual({ n: 2 });
      expect(readMigrationRecords(db)).toHaveLength(2);
    },
  );

  it("外部キーの違反を残す migration は、違反の行を文言に入れて落とし、変更も記録も残さない", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    const recordsBefore = readMigrationRecords(db);
    // 親 2 をコピーから落とすと、親 2 を指す子 (books の rowid 3) の参照先が無くなる
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors(' WHERE "id" <> 2')]);

    expect(() => migrateDb(db, dir.path)).toThrow(
      /外部キーの違反.*"table":"books","rowid":3,"parent":"authors"/,
    );

    expect(db.$client.prepare("select id from authors order by id").all()).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(readBooks(db)).toEqual(BOOKS);
    expect(readMigrationRecords(db)).toEqual(recordsBefore);
    expect(db.$client.inTransaction).toBe(false);
  });

  it("未適用の migration のどれかが違反を増やせば、ほかの migration の変更と記録も残さない", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    const recordsBefore = readMigrationRecords(db);
    writeMigrations(dir.path, [
      createTables("no action"),
      CREATE_PUBLISHERS,
      rebuildAuthors(' WHERE "id" <> 2'),
    ]);

    expect(() => migrateDb(db, dir.path)).toThrow(/外部キーの違反/);

    expect(
      db.$client.prepare("select name from sqlite_schema where name = 'publishers'").all(),
    ).toEqual([]);
    expect(readMigrationRecords(db)).toEqual(recordsBefore);
  });

  // SQLite の手順の検査は、スキーマの変更が外部キーを壊していないことを確かめる。当てる前からある違反で止めると、
  // 違反のある DB では違反と関係の無い migration も当てられない
  it("当てる前からある違反だけなら、増えていないので当てる", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    insertOrphanBook(db);
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors()]);

    migrateDb(db, dir.path);

    expect(readMigrationRecords(db)).toHaveLength(2);
    expect(readBooks(db)).toEqual([...BOOKS, { id: 4, author_id: 9 }]);
  });

  it("当てる前からある違反があっても、増えた違反で落とし、文言には増えた違反だけを出す", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    insertOrphanBook(db);
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors(' WHERE "id" <> 2')]);

    expect(() => migrateDb(db, dir.path)).toThrow(
      /外部キーの違反を増やすので、適用せずに戻した: \[\{"table":"books","rowid":3,"parent":"authors","fkid":0\}\]$/,
    );
  });

  it("外部キーの検査を戻せなかったら、migration の失敗を cause に残して落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors(' WHERE "id" <> 2')]);
    // ON に戻す PRAGMA だけを落とし、ほかの PRAGMA は元の実装へ通す。既定の passthrough は spyOn の元の実装を
    // 呼ばずに undefined を返したので (2026-11-23、vitest 5.1.0 で実測)、元の実装を onUnmatched に渡す
    const pragma = db.$client.pragma.bind(db.$client);
    using _pragma = vi
      .when(vi.spyOn(db.$client, "pragma"), { onUnmatched: pragma })
      .calledWith("foreign_keys = ON")
      .thenThrow(new Error("disk I/O error"));

    let thrown: unknown;
    try {
      migrateDb(db, dir.path);
    } catch (error) {
      thrown = error;
    }

    expect.assert(thrown instanceof Error);
    expect(thrown.message).toMatch(/外部キーの検査を戻せない.*disk I\/O error/);
    expect.assert(thrown.cause instanceof Error);
    expect(thrown.cause.message).toMatch(/外部キーの違反を増やす/);
  });

  it("適用し終えたら、成功しても失敗しても、接続の外部キーの検査を有効に戻す", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);

    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors(' WHERE "id" <> 2')]);
    expect(() => migrateDb(db, dir.path)).toThrow(/外部キーの違反/);
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("適用済みの migration を流し直さない", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors()]);
    migrateDb(db, dir.path);
    const records = readMigrationRecords(db);

    // 流し直すと 1 本目の CREATE TABLE が `table already exists` で落ちる
    expect(() => migrateDb(db, dir.path)).not.toThrow();
    expect(readMigrationRecords(db)).toEqual(records);
  });

  // `vp run db:migrate` を drizzle-kit migrate で打っていた DB と、drizzle の migrator で当てる経路が残る DB を
  // 引き継げるよう、適用済みの記録の形と、適用済みとみなす条件を drizzle-orm の migrator とそろえる
  it("drizzle-orm の migrator が当てた記録を引き継ぎ、残りだけを当てる", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDb(":memory:");
    writeMigrations(dir.path, [createTables("no action")]);
    migrate(db, { migrationsFolder: dir.path });

    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors()]);
    migrateDb(db, dir.path);

    expect(readMigrationRecords(db)).toEqual(
      readMigrationFiles({ migrationsFolder: dir.path }).map(({ hash, folderMillis }) => ({
        hash,
        created_at: folderMillis,
      })),
    );
  });

  it("migrateDb が当てた記録を、drizzle-orm の migrator も適用済みとみなす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDb(":memory:");
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors()]);
    migrateDb(db, dir.path);
    const records = readMigrationRecords(db);

    // 流し直すと 1 本目の CREATE TABLE が `table already exists` で落ちる
    expect(() => migrate(db, { migrationsFolder: dir.path })).not.toThrow();
    expect(readMigrationRecords(db)).toEqual(records);
  });

  // SQLite はトランザクションの中の PRAGMA foreign_keys を無視し、エラーも返さない
  it("外部キーの検査を切れない接続では、migration を当てずに落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    writeMigrations(dir.path, [createTables("no action")]);
    const db = createDb(":memory:");
    db.$client.exec("BEGIN");

    expect(() => migrateDb(db, dir.path)).toThrow(/外部キーの検査を切れない/);
    // ROLLBACK の前に見る。後に見ると、開いたトランザクションの中で当たっていても ROLLBACK が消す
    expect(
      db.$client.prepare("select name from sqlite_schema where name = 'authors'").all(),
    ).toEqual([]);
    db.$client.exec("ROLLBACK");
  });
});
