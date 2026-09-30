import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    // 暦の日付 (ADR-0031) を YYYY-MM-DD の TEXT で持つ。期日なしは NULL
    dueDate: text("due_date"),
    // 作成日時と更新日時は瞬間 (ADR-0031) を UTC のエポックミリ秒で持つ。値は DB の
    // 既定値で入れる (drizzle docs のガイド「Timestamp as a default value」)。更新日時は
    // drizzle の update のたびに $onUpdate がアプリの時計で入れる
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsecond') * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsecond') * 1000)`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // SQLite の date() は暦に無い日を翌月へ繰り越し、YYYY-MM-DD 以外の形は別の文字列か NULL にする。
    // 自分と一致する値だけを通し、入力スキーマを通らない書き込みでも暦に無い日付を入れさせない。
    // date() の結果は 0000〜9999 年の外で未定義で (SQLite「Date And Time Functions」)、負の年
    // (-0001-01-01) も一致して通るので、長さで範囲内の YYYY-MM-DD に絞る
    check(
      "notes_due_date_is_calendar_date",
      sql`${table.dueDate} IS date(${table.dueDate}) AND length(${table.dueDate}) = 10`,
    ),
  ],
);
