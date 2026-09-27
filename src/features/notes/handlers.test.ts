import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDb, migrateDb } from "@/server/db";

import { createNoteHandlers } from "./handlers.server";
import { noteListFilterSchema } from "./schema";

/** 絞り込みなし。schema の既定 (`q` を省略) から導き、既定が変われば追随する。 */
const NO_FILTER = v.parse(noteListFilterSchema, {});

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
      expect(await handlers.list(NO_FILTER)).toEqual([]);
    });

    it("createdAt の新しい順に返す", async () => {
      await handlers.create({ title: "古い", body: "", dueDate: null });
      vi.advanceTimersByTime(1000);
      await handlers.create({ title: "新しい", body: "", dueDate: null });

      expect((await handlers.list(NO_FILTER)).map((note) => note.title)).toEqual([
        "新しい",
        "古い",
      ]);
    });

    it("createdAt が同一でも id の降順で決定的に並ぶ", async () => {
      // 同一ミリ秒での連続作成。createdAt だけでは順序が決まらない
      const first = await handlers.create({ title: "先", body: "", dueDate: null });
      const second = await handlers.create({ title: "後", body: "", dueDate: null });

      const listed = await handlers.list(NO_FILTER);
      expect(listed.map((note) => note.createdAt.getTime())).toEqual([
        listed[0]!.createdAt.getTime(),
        listed[0]!.createdAt.getTime(),
      ]);
      expect(listed.map((note) => note.id)).toEqual([second.id, first.id]);
    });

    it("q が空なら全件を返す", async () => {
      await handlers.create({ title: "りんご", body: "", dueDate: null });
      await handlers.create({ title: "みかん", body: "", dueDate: null });

      expect((await handlers.list({ q: "" })).map((note) => note.title)).toEqual([
        "みかん",
        "りんご",
      ]);
    });

    it("q を title の部分一致で絞る (body は見ない)", async () => {
      await handlers.create({ title: "買い物リスト", body: "りんご", dueDate: null });
      await handlers.create({ title: "りんごの育て方", body: "", dueDate: null });
      await handlers.create({ title: "青りんご", body: "", dueDate: null });

      expect((await handlers.list({ q: "りんご" })).map((note) => note.title)).toEqual([
        "青りんご",
        "りんごの育て方",
      ]);
    });

    it("% と _ はワイルドカードではなく文字として扱う", async () => {
      await handlers.create({ title: "100%", body: "", dueDate: null });
      await handlers.create({ title: "100x", body: "", dueDate: null });
      await handlers.create({ title: "a_b", body: "", dueDate: null });
      await handlers.create({ title: "axb", body: "", dueDate: null });

      expect((await handlers.list({ q: "100%" })).map((note) => note.title)).toEqual(["100%"]);
      expect((await handlers.list({ q: "a_b" })).map((note) => note.title)).toEqual(["a_b"]);
    });

    // エスケープ文字そのものを含む検索語。漏れると `\` が次の文字のエスケープになり別の行に当たる
    it("\\ はエスケープの解除ではなく文字として扱う", async () => {
      await handlers.create({ title: "C:\\dir", body: "", dueDate: null });
      await handlers.create({ title: "C:dir", body: "", dueDate: null });

      expect((await handlers.list({ q: "C:\\" })).map((note) => note.title)).toEqual(["C:\\dir"]);
    });

    it("ASCII の英字は大文字小文字を区別しない (SQLite の LIKE の既定)", async () => {
      await handlers.create({ title: "React", body: "", dueDate: null });

      expect((await handlers.list({ q: "react" })).map((note) => note.title)).toEqual(["React"]);
    });

    it("一致しなければ空配列", async () => {
      await handlers.create({ title: "りんご", body: "", dueDate: null });

      expect(await handlers.list({ q: "ぶどう" })).toEqual([]);
    });
  });

  describe("list の読み出し時検証", () => {
    /**
     * drizzle を迂用して行を直接入れる。drizzle の型は「そう入っているはず」の主張でしかなく、
     * 実データがそれを満たす保証にはならない。ずれを実行時に検出できるかを確かめる。
     */
    function insertRawRow(row: {
      id?: number;
      title: string;
      body: string;
      createdAt: number;
      dueDate?: string;
    }) {
      if (row.id === undefined) {
        db.$client
          .prepare("insert into notes (title, body, created_at, due_date) values (?, ?, ?, ?)")
          .run(row.title, row.body, row.createdAt, row.dueDate ?? null);
        return;
      }
      db.$client
        .prepare("insert into notes (id, title, body, created_at, due_date) values (?, ?, ?, ?, ?)")
        .run(row.id, row.title, row.body, row.createdAt, row.dueDate ?? null);
    }

    it("title が maxLength(100) を超える行があれば throw する", async () => {
      insertRawRow({ title: "あ".repeat(101), body: "", createdAt: Date.now() });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("title が空の行があれば throw する", async () => {
      insertRawRow({ title: "", body: "", createdAt: Date.now() });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/スキーマ検証に失敗/);
    });

    // 読み出しゲートは値を書き換えない。trim して通すと、手書き SQL 由来の未 trim の行が
    // 画面上は整って見え、保存値との乖離に気付けなくなる
    it("title が trim されていない行があれば throw する", async () => {
      insertRawRow({ title: "  padded  ", body: "", createdAt: Date.now() });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("id が 1 未満の行があれば throw する (noteIdSchema と同じ制約で読む)", async () => {
      insertRawRow({ id: 0, title: "見出し", body: "", createdAt: Date.now() });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/スキーマ検証に失敗/);
    });

    it("失敗した項目の位置を message に含める (どの行のどの項目かを追える)", async () => {
      insertRawRow({ title: "あ".repeat(101), body: "", createdAt: Date.now() });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/0\.title/);
    });

    it("正常な行だけなら throw しない", async () => {
      insertRawRow({ title: "見出し", body: "本文", createdAt: Date.now() });

      expect(await handlers.list(NO_FILTER)).toHaveLength(1);
    });

    // 手書き SQL で入った暦に無い日付を、読み出しゲートで顕在化させる
    it("暦に無い due_date の行があれば throw する", async () => {
      insertRawRow({ title: "見出し", body: "", createdAt: Date.now(), dueDate: "2023-02-29" });

      await expect(handlers.list(NO_FILTER)).rejects.toThrow(/0\.dueDate/);
    });
  });

  describe("create", () => {
    it("採番した id を返し、入力どおりに保存する", async () => {
      const created = await handlers.create({ title: "見出し", body: "本文", dueDate: null });

      expect(created.id).toBeGreaterThan(0);
      const listed = await handlers.list(NO_FILTER);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({ id: created.id, title: "見出し", body: "本文" });
    });

    it("createdAt に作成時刻を入れる", async () => {
      await handlers.create({ title: "見出し", body: "", dueDate: null });

      const listed = await handlers.list(NO_FILTER);
      expect(listed[0]!.createdAt).toEqual(new Date("2026-08-17T09:00:00.000Z"));
    });

    it("空の body をそのまま保存する", async () => {
      await handlers.create({ title: "見出し", body: "", dueDate: null });

      expect((await handlers.list(NO_FILTER))[0]!.body).toBe("");
    });
  });

  describe("dueDate", () => {
    it("期日ありで保存すると同じ YYYY-MM-DD で読み出す", async () => {
      await handlers.create({ title: "期日あり", body: "", dueDate: "2026-08-20" });

      expect((await handlers.list(NO_FILTER))[0]!.dueDate).toBe("2026-08-20");
    });

    it("期日なしで保存すると null で読み出す", async () => {
      await handlers.create({ title: "期日なし", body: "", dueDate: null });

      expect((await handlers.list(NO_FILTER))[0]!.dueDate).toBeNull();
    });
  });

  describe("remove", () => {
    it("指定した 1 件だけを削除する", async () => {
      const target = await handlers.create({ title: "消す", body: "", dueDate: null });
      const survivor = await handlers.create({ title: "残す", body: "", dueDate: null });

      await handlers.remove({ id: target.id });

      expect((await handlers.list(NO_FILTER)).map((note) => note.id)).toEqual([survivor.id]);
    });

    it("存在しない id では throw する (削除 0 件を成功として黙らせない)", async () => {
      await expect(handlers.remove({ id: 999 })).rejects.toThrow(/999/);
    });

    it("同じ id を 2 度削除すると 2 度目は throw する", async () => {
      const created = await handlers.create({ title: "消す", body: "", dueDate: null });
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
      await handlers.create({ title: "こちらだけ", body: "", dueDate: null });

      expect(await handlers.list(NO_FILTER)).toHaveLength(1);
      expect(await otherHandlers.list(NO_FILTER)).toHaveLength(0);
    } finally {
      otherDb.$client.close();
    }
  });
});
