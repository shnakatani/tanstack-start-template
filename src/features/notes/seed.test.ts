import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createDb, migrateDb } from "@/server/db";
import { notes } from "@/server/db/schema";

import { noteSchema } from "./schema";
import { NOTE_SEEDS, seedNotes } from "./seed.server";

describe("seedNotes", () => {
  let db: ReturnType<typeof createDb>;

  function readRows() {
    return db.select().from(notes).orderBy(notes.id).all();
  }

  beforeEach(() => {
    db = createDb(":memory:");
    migrateDb(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  // 一覧の読み出しは保存済みの 1 件のスキーマで行を検証し、通らない行が 1 つでもあると一覧ごと落ちる。
  // noteSchema は入力のスキーマの項目に、保存済みの title の検証 (前後の空白を許さない) を重ねたもの
  it.each(NOTE_SEEDS)("見本の「$title」が保存済みの 1 件のスキーマを通る", (seed) => {
    expect(v.safeParse(noteSchema, seed).issues).toBeUndefined();
  });

  it("2 回続けて入れても、見本の行が同じ id・日時・中身で並ぶ", () => {
    seedNotes(db);
    expect(readRows()).toEqual(NOTE_SEEDS);

    seedNotes(db);
    expect(readRows()).toEqual(NOTE_SEEDS);
  });

  it("手で足した行を消し、見本の行だけを残す", () => {
    db.insert(notes).values({ id: 50, title: "手で足した行" }).run();

    seedNotes(db);

    expect(readRows()).toEqual(NOTE_SEEDS);
  });

  it("入れたあとに作る行の id は、見本の最大の id の続きになる", () => {
    db.insert(notes).values({ id: 50, title: "手で足した行" }).run();

    seedNotes(db);
    const [created] = db.insert(notes).values({ title: "新しい行" }).returning().all();

    expect(created?.id).toBe(Math.max(...NOTE_SEEDS.map((seed) => seed.id)) + 1);
  });
});
