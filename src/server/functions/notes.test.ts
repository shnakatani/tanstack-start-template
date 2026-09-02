import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDb, migrateDb } from "@/server/db";

import { createNoteHandlers } from "./notes.server";

/** migration 適用済みの空 DB を 1 件だけ抱えるテスト用の接続を作る。 */
function createTestDb() {
  const db = createDb(":memory:");
  migrateDb(db);
  return db;
}

describe("notes handlers", () => {
  let db: ReturnType<typeof createTestDb>;
  let handlers: ReturnType<typeof createNoteHandlers>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
    db = createTestDb();
    handlers = createNoteHandlers(() => db);
  });

  afterEach(() => {
    db.$client.close();
    vi.useRealTimers();
  });

  describe("list", () => {
    it("1 件も無ければ空配列を返す", async () => {
      expect(await handlers.list()).toEqual([]);
    });

    it("createdAt の新しい順に返す", async () => {
      await handlers.create({ title: "古い", body: "" });
      vi.advanceTimersByTime(1000);
      await handlers.create({ title: "新しい", body: "" });

      expect((await handlers.list()).map((note) => note.title)).toEqual(["新しい", "古い"]);
    });

    it("createdAt が同一でも id の降順で決定的に並ぶ", async () => {
      // 同一ミリ秒での連続作成。createdAt だけでは順序が決まらない
      const first = await handlers.create({ title: "先", body: "" });
      const second = await handlers.create({ title: "後", body: "" });

      const listed = await handlers.list();
      expect(listed.map((note) => note.createdAt.getTime())).toEqual([
        listed[0]!.createdAt.getTime(),
        listed[0]!.createdAt.getTime(),
      ]);
      expect(listed.map((note) => note.id)).toEqual([second.id, first.id]);
    });
  });

  describe("list の読み出し時検証", () => {
    /**
     * drizzle を迂用して行を直接入れる。drizzle の型は「そう入っているはず」の主張でしかなく、
     * 実データがそれを満たす保証にはならない。ずれを実行時に検出できるかを確かめる。
     */
    function insertRawRow(row: { id?: number; title: string; body: string; createdAt: number }) {
      if (row.id === undefined) {
        db.$client
          .prepare("insert into notes (title, body, created_at) values (?, ?, ?)")
          .run(row.title, row.body, row.createdAt);
        return;
      }
      db.$client
        .prepare("insert into notes (id, title, body, created_at) values (?, ?, ?, ?)")
        .run(row.id, row.title, row.body, row.createdAt);
    }

    it("title が maxLength(100) を超える行があれば throw する", async () => {
      insertRawRow({ title: "あ".repeat(101), body: "", createdAt: Date.now() });

      await expect(handlers.list()).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("title が空の行があれば throw する", async () => {
      insertRawRow({ title: "", body: "", createdAt: Date.now() });

      await expect(handlers.list()).rejects.toThrow(/スキーマ検証に失敗/);
    });

    // 読み出しゲートは値を書き換えない。trim して通すと、手書き SQL 由来の未 trim の行が
    // 画面上は整って見え、保存値との乖離に気付けなくなる
    it("title が trim されていない行があれば throw する", async () => {
      insertRawRow({ title: "  padded  ", body: "", createdAt: Date.now() });

      await expect(handlers.list()).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("id が 1 未満の行があれば throw する (noteIdSchema と同じ制約で読む)", async () => {
      insertRawRow({ id: 0, title: "見出し", body: "", createdAt: Date.now() });

      await expect(handlers.list()).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("失敗した項目の位置を message に含める (どの行のどの項目かを追える)", async () => {
      insertRawRow({ title: "あ".repeat(101), body: "", createdAt: Date.now() });

      await expect(handlers.list()).rejects.toThrow(/0\.title/);
    });

    it("正常な行だけなら throw しない", async () => {
      insertRawRow({ title: "見出し", body: "本文", createdAt: Date.now() });

      expect(await handlers.list()).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("採番した id を返し、入力どおりに保存する", async () => {
      const created = await handlers.create({ title: "見出し", body: "本文" });

      expect(created.id).toBeGreaterThan(0);
      const listed = await handlers.list();
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({ id: created.id, title: "見出し", body: "本文" });
    });

    it("createdAt に作成時刻を入れる", async () => {
      await handlers.create({ title: "見出し", body: "" });

      const listed = await handlers.list();
      expect(listed[0]!.createdAt).toEqual(new Date("2026-08-17T09:00:00.000Z"));
    });

    it("空の body をそのまま保存する", async () => {
      await handlers.create({ title: "見出し", body: "" });

      expect((await handlers.list())[0]!.body).toBe("");
    });
  });

  describe("remove", () => {
    it("指定した 1 件だけを削除する", async () => {
      const target = await handlers.create({ title: "消す", body: "" });
      const survivor = await handlers.create({ title: "残す", body: "" });

      await handlers.remove({ id: target.id });

      expect((await handlers.list()).map((note) => note.id)).toEqual([survivor.id]);
    });

    it("存在しない id では throw する (削除 0 件を成功として黙らせない)", async () => {
      await expect(handlers.remove({ id: 999 })).rejects.toThrow(/999/);
    });

    it("同じ id を 2 度削除すると 2 度目は throw する", async () => {
      const created = await handlers.create({ title: "消す", body: "" });
      await handlers.remove({ id: created.id });

      await expect(handlers.remove({ id: created.id })).rejects.toThrow(
        `削除対象のノートが見つかりません: id=${created.id}`,
      );
    });
  });

  it("注入した DB ごとに独立する (module-level singleton を掴んでいない)", async () => {
    const otherDb = createTestDb();
    const otherHandlers = createNoteHandlers(() => otherDb);
    try {
      await handlers.create({ title: "こちらだけ", body: "" });

      expect(await handlers.list()).toHaveLength(1);
      expect(await otherHandlers.list()).toHaveLength(0);
    } finally {
      otherDb.$client.close();
    }
  });
});
