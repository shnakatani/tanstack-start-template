import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { notes } from "@/server/db/schema";

import { createDb, migrateDb } from "./index";

const MISSING_DB_MESSAGE =
  /^\[db\] DB のファイルが無い。mise run db:migrate で作るか、DB_FILE_NAME を確かめる$/;

describe("createDb", () => {
  const originalDbFileName = process.env.DB_FILE_NAME;

  afterEach(() => {
    if (originalDbFileName === undefined) {
      delete process.env.DB_FILE_NAME;
    } else {
      process.env.DB_FILE_NAME = originalDbFileName;
    }
  });

  it("DB_FILE_NAME 未設定なら throw する (fail-closed)", () => {
    delete process.env.DB_FILE_NAME;
    expect(() => createDb()).toThrow(/DB_FILE_NAME/);
  });

  it(":memory: で接続し、migration 適用後に notes への insert/select が通る", () => {
    const db = createDb(":memory:");
    migrateDb(db);

    db.insert(notes).values({ title: "hello", body: "world" }).run();
    const rows = db.select().from(notes).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "hello", body: "world" });
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  // 暦の日付 (ADR-0031 の分類 2) は、入力スキーマを通らない書き込みでも形と暦の存在を DB が守る
  it("notes.due_date は暦にある 0000〜9999 年の YYYY-MM-DD か NULL だけを受け入れる", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    const insert = db.$client.prepare(
      "insert into notes (title, body, created_at, due_date) values ('見出し', '', 0, ?)",
    );

    for (const accepted of ["2026-08-07", "2024-02-29", null]) {
      expect(() => insert.run(accepted), String(accepted)).not.toThrow();
    }
    for (const rejected of [
      "2023-02-29",
      "2023-06-31",
      "2026-8-7",
      "2026-08-07T00:00",
      "-0001-01-01",
      "",
    ]) {
      expect(() => insert.run(rejected), rejected).toThrow(/CHECK constraint failed/);
    }
  });

  // 作成日時と更新日時は DB の既定値で入る (drizzle docs のガイド「Timestamp as a default value」)。
  // drizzle を通らない insert でも値が入ることを固定する
  it("created_at と updated_at を省いた insert に、DB が同じ現在時刻を入れる", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    const before = Date.now();
    db.$client.prepare("insert into notes (title, body) values ('見出し', '')").run();
    const after = Date.now();

    const row = db.$client.prepare("select created_at, updated_at from notes").get();
    // 形の検査と型の絞り込みを v.parse で兼ねる。strictObject は余分な列も issue にする
    const { created_at: createdAt, updated_at: updatedAt } = v.parse(
      v.strictObject({ created_at: v.number(), updated_at: v.number() }),
      row,
    );
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(updatedAt).toBe(createdAt);
  });

  // アプリは migration を当てないので、作った空の DB は最初のクエリで落ちるだけになる。作らずに落とす
  // server function の例外の文言は client に直列化されて返るので、パスは文言に入れず server のログにだけ残す
  it("DB のファイルが無ければ作らずに throw し、開こうとしたパスは server のログにだけ残す", () => {
    const dir = mkdtempSync(join(tmpdir(), "db-test-"));
    const fileName = join(dir, "missing.sqlite");
    using error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // 文言を完全一致で固定し、throw することとパスを含まないことを 1 本で確かめる
      expect(() => createDb(fileName)).toThrow(MISSING_DB_MESSAGE);
      expect(error).toHaveBeenCalledWith("[db] DB のファイルが無い", { path: fileName });
      expect(existsSync(fileName)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ディレクトリを渡しても、開こうとしたパスをログに残して throw する", () => {
    const dir = mkdtempSync(join(tmpdir(), "db-test-"));
    using error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => createDb(dir)).toThrow(MISSING_DB_MESSAGE);
      expect(error).toHaveBeenCalledWith("[db] DB のファイルが無い", { path: dir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("既にある DB のファイルを開く", () => {
    const dir = mkdtempSync(join(tmpdir(), "db-test-"));
    const fileName = join(dir, "dev.sqlite");
    new Database(fileName).close();

    let db: ReturnType<typeof createDb> | undefined;
    try {
      db = createDb(fileName);
      // native binding での接続自体が有効であることも確認する (migration 未適用でも通る素の疎通)
      expect(db.$client.prepare("select 1 as one").get()).toEqual({ one: 1 });
    } finally {
      // 開いたままの handle を残して削除すると、WAL/journal の後始末が走らず削除も取りこぼす
      db?.$client.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
