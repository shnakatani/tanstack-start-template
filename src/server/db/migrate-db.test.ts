import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

import Database from "better-sqlite3";
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

/** 親を参照する WITHOUT ROWID の子 (reviews) を足す migration */
const CREATE_REVIEWS = `CREATE TABLE \`reviews\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`author_id\` integer,
	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE no action
) WITHOUT ROWID;
`;

/** 親 2 を消す custom migration。検査を切った接続では ON DELETE の動作が走らず、親 2 を指す子が残る */
const DELETE_AUTHOR_2 = "DELETE FROM `authors` WHERE `id` = 2;";

/** 親を参照し、主キーが整数でない子 (tags) を足す migration。rowid は主キーと別に持つ */
const CREATE_TAGS = `CREATE TABLE \`tags\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`author_id\` integer,
	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE no action
);
`;

/** tags に NOT NULL の列を足す migration。drizzle-kit 0.31.11 の generate が出力する作り直しの形 */
function rebuildTags(): string {
  return `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_tags\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`author_id\` integer,
	\`label\` text DEFAULT '' NOT NULL,
	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO \`__new_tags\`("key", "author_id") SELECT "key", "author_id" FROM \`tags\`;--> statement-breakpoint
DROP TABLE \`tags\`;--> statement-breakpoint
ALTER TABLE \`__new_tags\` RENAME TO \`tags\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;`;
}

/** 外部キーの検査を切って、どの親も指さない reviews の行を入れる。当てる前からある違反を作る */
function insertOrphanReview(db: ReturnType<typeof createDb>): void {
  db.$client.pragma("foreign_keys = OFF");
  db.$client.exec("insert into reviews (key, author_id) values ('r9', 9)");
  db.$client.pragma("foreign_keys = ON");
}

/** books の違反の行を消す custom migration。rowid のある表は foreign_key_check の rowid でも引ける */
const DELETE_ORPHAN_BOOKS =
  "DELETE FROM `books` WHERE `author_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `authors` p WHERE p.`id` = `books`.`author_id`);";

/** reviews (WITHOUT ROWID) の違反の行を、foreign_key_list の from / table / to から組んだ NOT EXISTS で消す custom migration */
const DELETE_ORPHAN_REVIEWS =
  "DELETE FROM `reviews` WHERE `author_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `authors` p WHERE p.`id` = `reviews`.`author_id`);";

/** tags の違反の行を消す custom migration */
const DELETE_ORPHAN_TAGS =
  "DELETE FROM `tags` WHERE `author_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `authors` p WHERE p.`id` = `tags`.`author_id`);";

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

  it("未適用の migration のどれかが違反を残せば、ほかの migration の変更と記録も残さない", () => {
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

  // 本番の DB を変える経路は vp run db:migrate だけなので、当てる前からある違反も migration で直せる
  it("当てる前からある違反を直す custom migration は、当たって記録される", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    insertOrphanBook(db);
    writeMigrations(dir.path, [createTables("no action"), DELETE_ORPHAN_BOOKS]);

    migrateDb(db, dir.path);

    expect(readBooks(db)).toEqual(BOOKS);
    expect(readMigrationRecords(db)).toHaveLength(2);
  });

  it.each([
    ["違反に関わる表を変える migration", rebuildAuthors()],
    ["違反に関係の無い migration", CREATE_PUBLISHERS],
  ])(
    "当てる前からある違反を直さない %s は、当てる前の違反の件数を文言に入れて落ち、何も残さない",
    (_label, migration) => {
      using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
      const db = createDbWithRows(dir.path, "no action");
      insertOrphanBook(db);
      const recordsBefore = readMigrationRecords(db);
      writeMigrations(dir.path, [createTables("no action"), migration]);

      expect(() => migrateDb(db, dir.path)).toThrow(
        /^\[db\] 当てる前から外部キーの違反が 1 件あり、当てたあとも違反が残るので、適用せずに戻した。違反を直す custom migration を先に足すと当たる: \[\{"table":"books","rowid":4,"parent":"authors","fkid":0\}\]$/,
      );

      expect(
        db.$client.prepare("select name from sqlite_schema where name = 'publishers'").all(),
      ).toEqual([]);
      expect(readMigrationRecords(db)).toEqual(recordsBefore);
      expect(db.$client.inTransaction).toBe(false);
    },
  );

  it("未適用の migration が無ければ、外部キーの違反があっても止めない", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    insertOrphanBook(db);

    expect(() => migrateDb(db, dir.path)).not.toThrow();
  });

  // foreign_key_check は WITHOUT ROWID の表の違反の rowid を NULL で返す。違反を rowid で見分けないので、取り違えない
  it("WITHOUT ROWID の子の表に違反を残す migration も、戻して落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS]);
    migrateDb(db, dir.path);
    // 親 2 を指すのを WITHOUT ROWID の子だけにする
    db.$client.exec(`
      delete from books where author_id = 2;
      insert into reviews (key, author_id) values ('r1', 1), ('r2', 2);
    `);
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS, DELETE_AUTHOR_2]);

    expect(() => migrateDb(db, dir.path)).toThrow(
      /違反を残すので、適用せずに戻した: \[\{"table":"reviews","rowid":null,"parent":"authors","fkid":0\}\]$/,
    );
    expect(db.$client.prepare("select id from authors order by id").all()).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("WITHOUT ROWID の子の表に当てる前から違反があっても、違反を足す migration は落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS]);
    migrateDb(db, dir.path);
    insertOrphanReview(db);
    db.$client.exec(`
      delete from books where author_id = 2;
      insert into reviews (key, author_id) values ('r2', 2);
    `);
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS, DELETE_AUTHOR_2]);

    // 違反は 2 件とも rowid が NULL で、当てる前の 1 件と見分けられないが、確定の前に違反があるので落とす
    expect(() => migrateDb(db, dir.path)).toThrow(
      /当てる前から外部キーの違反が 1 件あり、.*: \[(\{"table":"reviews","rowid":null,"parent":"authors","fkid":0\},?){2}\]$/,
    );
    expect(db.$client.prepare("select id from authors order by id").all()).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("WITHOUT ROWID の子の表の違反の行を NOT EXISTS で引いて消す custom migration は当たる", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS]);
    migrateDb(db, dir.path);
    insertOrphanReview(db);
    writeMigrations(dir.path, [createTables("no action"), CREATE_REVIEWS, DELETE_ORPHAN_REVIEWS]);

    migrateDb(db, dir.path);

    expect(db.$client.prepare("select key from reviews").all()).toEqual([]);
  });

  // 主キーが整数でない表は rowid を別に持ち、作り直すと rowid が詰まって変わる。違反を rowid で突き合わせないので、
  // 作り直しで rowid が変わっても、当てる前の違反を直したかだけで決まる
  it("違反のある子の表を作り直す migration は、違反を直さなければ落とし、直せば当てる", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), CREATE_TAGS]);
    migrateDb(db, dir.path);
    db.$client.exec(`
      insert into tags (key, author_id) values ('a', 1), ('b', 1), ('c', 2);
      delete from tags where key = 'a';
    `);
    db.$client.pragma("foreign_keys = OFF");
    db.$client.exec("insert into tags (key, author_id) values ('z', 9)");
    db.$client.pragma("foreign_keys = ON");

    writeMigrations(dir.path, [createTables("no action"), CREATE_TAGS, rebuildTags()]);
    expect(() => migrateDb(db, dir.path)).toThrow(
      /当てる前から外部キーの違反が 1 件あり、.*: \[\{"table":"tags","rowid":3,"parent":"authors","fkid":0\}\]$/,
    );

    writeMigrations(dir.path, [
      createTables("no action"),
      CREATE_TAGS,
      rebuildTags(),
      DELETE_ORPHAN_TAGS,
    ]);
    migrateDb(db, dir.path);
    // 作り直しで rowid が 2、3、4 から 1、2、3 に詰まり、違反の行 (rowid 4 → 3) を消した
    expect(db.$client.prepare("select rowid, key, author_id from tags order by key").all()).toEqual(
      [
        { rowid: 1, key: "b", author_id: 1 },
        { rowid: 2, key: "c", author_id: 2 },
      ],
    );
  });

  it("違反のある子の表を改名するだけの migration は、違反が残るので落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    insertOrphanBook(db);
    writeMigrations(dir.path, [
      createTables("no action"),
      "ALTER TABLE `books` RENAME TO `volumes`;",
    ]);

    expect(() => migrateDb(db, dir.path)).toThrow(
      /当てる前から外部キーの違反が 1 件あり、.*: \[\{"table":"volumes","rowid":4,"parent":"authors","fkid":0\}\]$/,
    );
  });

  it("外部キーの検査を戻せなかったら、migration の失敗を cause に残して落とす", () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const db = createDbWithRows(dir.path, "no action");
    writeMigrations(dir.path, [createTables("no action"), rebuildAuthors(' WHERE "id" <> 2')]);
    // ON に戻す PRAGMA だけを落とし、ほかの PRAGMA は元の実装へ通す。既定の passthrough は spyOn の元の実装を
    // 呼ばずに undefined を返したので (2026-11-23、vitest 5.1.0 で実測)、元の実装を onUnmatched に渡す
    const pragma = db.$client.pragma.bind(db.$client);
    using restoring = vi
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
    expect(thrown.cause.message).toMatch(/外部キーの違反を残す/);
    expect(restoring).toHaveBeenExhausted();
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

  // 別の接続が 2 本目を当てている最中 (書き込みのロックを持ち、まだ確定していない) に migrateDb を呼ぶ。
  // migrateDb は記録の読み出しから書き込みのロックの中で行うので、相手の確定を待ち、その記録を読んで 2 本目を流さない。
  // 相手は 300ms ロックを持つ。migrateDb を呼ぶまでに 300ms 過ぎると、相手が確定してから読むことになり、競合は
  // 起きないまま通る。時間の当て推量が外れても、落ちるべき実装を通す向きにしか外れず、正しい実装を落とさない
  it("別の接続が当てている最中に呼んでも、相手の確定を待ち、同じ migration を二度当てない", async () => {
    using dir = mkdtempDisposableSync(join(tmpdir(), "migrate-db-test-"));
    const fileName = join(dir.path, "test.sqlite");
    new Database(fileName).close();
    const folder = join(dir.path, "migrations");
    const createCounter =
      "CREATE TABLE `counter` (`n` integer NOT NULL);\n--> statement-breakpoint\nINSERT INTO `counter` VALUES (0);";
    const incrementCounter = "UPDATE `counter` SET `n` = `n` + 1;";
    writeMigrations(folder, [createCounter]);
    const db = createDb(fileName);
    migrateDb(db, folder);
    writeMigrations(folder, [createCounter, incrementCounter]);
    const [, second] = readMigrationFiles({ migrationsFolder: folder });
    expect.assert(second !== undefined);

    const locked = new Int32Array(new SharedArrayBuffer(4));
    const worker = new Worker(
      `
      const { workerData } = require("node:worker_threads");
      const Database = require(workerData.betterSqlite3);
      const db = new Database(workerData.fileName);
      db.exec("BEGIN IMMEDIATE");
      db.exec(workerData.incrementCounter);
      db.prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)').run(workerData.hash, workerData.createdAt);
      Atomics.store(workerData.locked, 0, 1);
      Atomics.notify(workerData.locked, 0);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
      db.exec("COMMIT");
      db.close();
      `,
      {
        eval: true,
        workerData: {
          betterSqlite3: createRequire(import.meta.url).resolve("better-sqlite3"),
          fileName,
          incrementCounter,
          hash: second.hash,
          createdAt: second.folderMillis,
          locked,
        },
      },
    );
    const exited = new Promise((resolve, reject) => {
      worker.on("exit", resolve);
      worker.on("error", reject);
    });
    try {
      expect(Atomics.wait(locked, 0, 0, 5000)).not.toBe("timed-out");

      migrateDb(db, folder);

      expect(db.$client.prepare("select n from counter").get()).toEqual({ n: 1 });
      expect(readMigrationRecords(db)).toHaveLength(2);
    } finally {
      // 落ちたときも worker の終わりを待ってから、一時ディレクトリを消す
      await exited;
      db.$client.close();
    }
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
