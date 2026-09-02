import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { notes } from "@/server/db/schema";

import { createDb, findProjectRoot, migrateDb } from "./index";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

/** cwd を一時的に移して関数を実行する。cwd はプロセス全体の状態なので必ず戻す */
function withCwd<T>(dir: string, run: () => T): T {
  const original = process.cwd();
  try {
    process.chdir(dir);
    return run();
  } finally {
    process.chdir(original);
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

  it("migration フォルダもプロジェクトルート基準で解決する", () => {
    withCwd(join(REPO_ROOT, "src"), () => {
      const db = createDb(":memory:");
      try {
        migrateDb(db);
        db.insert(notes).values({ title: "hello", body: "world" }).run();
        expect(db.select().from(notes).all()).toHaveLength(1);
      } finally {
        db.$client.close();
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
