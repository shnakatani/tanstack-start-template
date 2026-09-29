import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as v from "valibot";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { notes } from "@/server/db/schema";

import { createDb, findProjectRoot, migrateDb } from "./index";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

/**
 * `process.cwd()` が `dir` を返す状態で関数を実行する。本物の cwd は動かさない。
 * `process.chdir()` は pool が threads のとき worker で使えない (vitest docs の config/pool)。
 * 検査したいのは「cwd を起点にプロジェクトルートを探す」ことなので、cwd を読む側に見せる値だけを変える。
 * `fs` に渡した相対パスは本物の cwd (テスト中はリポジトリのルート) で解決されるので、相対パスのまま
 * 渡されていないことは、ファイルの有無ではなく渡したパスで確かめる
 */
function withCwd<T>(dir: string, run: () => T): T {
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(dir);
  try {
    return run();
  } finally {
    cwd.mockRestore();
  }
}

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

  it("接続先ディレクトリが存在しなければ作成する", () => {
    const dir = join(tmpdir(), `db-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const fileName = join(dir, "nested", "dev.sqlite");
    expect(existsSync(join(dir, "nested"))).toBe(false);

    let db: ReturnType<typeof createDb> | undefined;
    try {
      db = createDb(fileName);
      expect(existsSync(join(dir, "nested"))).toBe(true);
      // native binding での接続自体が有効であることも確認する (migration 未適用でも通る素の疎通)
      expect(db.$client.prepare("select 1 as one").get()).toEqual({ one: 1 });
    } finally {
      // 開いたままの handle を残して削除すると、WAL/journal の後始末が走らず削除も取りこぼす
      db?.$client.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // cwd 相対のままだと、サブディレクトリから起動したときに DB_FILE_NAME が別の場所を指し、
  // migration 未適用の空 DB が黙って作られる (「データが消えた」に見える)
  it("相対パスの接続先をプロジェクトルート基準で解決する", () => {
    const root = mkdtempSync(join(tmpdir(), "db-root-"));
    const sub = join(root, "src", "server");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(root, "package.json"), "{}\n");

    try {
      withCwd(sub, () => {
        const db = createDb(join(".data", "dev.sqlite"));
        db.$client.close();
      });

      expect(existsSync(join(root, ".data", "dev.sqlite"))).toBe(true);
      expect(existsSync(join(sub, ".data", "dev.sqlite"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("migration フォルダもプロジェクトルート基準で解決する", async () => {
    // migration フォルダの解決先を、migrate に渡した引数で確かめる。spy: true は元の実装を保つので、
    // スキーマも実際に作られる。先に走ったファイルが `./index` を本物の migrator のまま読み込んでいる
    // ことがあるので、読み直す前にモジュールのキャッシュを消す (vitest docs の api/vi「vi.resetModules」)。
    // doMock は using で受けるとテストを抜けるときに外れるが、外れるのは登録だけで、読み直した `./index`
    // は spy をつかんだままキャッシュに残る (同じく「vi.doUnmock」)。isolate: false で後に走るファイルに
    // 渡さないよう、テストの終わりにもう一度キャッシュを消す
    vi.resetModules();
    onTestFinished(() => {
      vi.resetModules();
    });
    using _migrator = vi.doMock(import("drizzle-orm/better-sqlite3/migrator"), { spy: true });
    const db = await import("./index");
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");

    withCwd(join(REPO_ROOT, "src"), () => {
      const client = db.createDb(":memory:");
      try {
        db.migrateDb(client);
        expect(vi.mocked(migrate)).toHaveBeenCalledExactlyOnceWith(client, {
          migrationsFolder: join(REPO_ROOT, "drizzle"),
        });
        client.insert(notes).values({ title: "hello", body: "world" }).run();
        expect(client.select().from(notes).all()).toHaveLength(1);
      } finally {
        client.$client.close();
      }
    });
  });
});

describe("findProjectRoot", () => {
  it("最も近い package.json を持つ祖先ディレクトリを返す", () => {
    const root = mkdtempSync(join(tmpdir(), "db-root-"));
    const nested = join(root, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, "package.json"), "{}\n");

    try {
      expect(findProjectRoot(nested)).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("自分自身が package.json を持つならそこを返す", () => {
    expect(findProjectRoot(REPO_ROOT)).toBe(REPO_ROOT);
  });

  // 見つからないまま黙って cwd 基準へ戻ると、接続先のずれが起点不明のまま残る
  it("package.json が見つからなければ起点をそのまま返し warn を残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const orphan = mkdtempSync(join(tmpdir(), "db-orphan-"));

    try {
      expect(findProjectRoot(orphan)).toBe(orphan);
      expect(warn).toHaveBeenCalledWith(
        "[db] package.json が見つからず、相対パスを起点ディレクトリ基準で解決します",
        { from: orphan },
      );
    } finally {
      warn.mockRestore();
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});
