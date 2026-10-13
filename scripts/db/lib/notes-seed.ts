import { getTableName, sql } from "drizzle-orm";

import type { Note } from "@/features/notes/schema";
import { notes } from "@/server/db/schema";

import type { SeededTable, SeedTransaction } from "./seed-all.ts";

/**
 * dev server で一覧を確かめるための見本。id の昇順に作成日時を進め、一覧の新しい順の並びを読めるようにする。
 * 未来の期日は、テンプレートを使う間に過去にならない年に置く
 */
export const NOTE_SEEDS: readonly Note[] = [
  {
    id: 1,
    title: "買い物リスト",
    body: "牛乳、食パン、卵を買う",
    dueDate: "2026-09-02",
    createdAt: new Date("2026-09-01T00:30:00Z"),
    updatedAt: new Date("2026-09-01T00:30:00Z"),
  },
  {
    id: 2,
    title: "読書メモ",
    body: "第 3 章まで読んだ。次は索引の章から読み直す",
    dueDate: null,
    createdAt: new Date("2026-09-03T09:15:00Z"),
    updatedAt: new Date("2026-09-12T21:40:00Z"),
  },
  {
    id: 3,
    title:
      "来週の定例会議で共有する、四半期の振り返りと次の四半期に向けた目標の案を、チームの全員から集めて一枚の資料にまとめる",
    body: "締め切りの前日までに集める",
    dueDate: "2026-09-15",
    createdAt: new Date("2026-09-08T02:00:00Z"),
    updatedAt: new Date("2026-09-08T02:00:00Z"),
  },
  {
    id: 4,
    title: "TransactionCoordinatorReplicationLagMonitoringDashboardConfigurationChecklist",
    body: "https://example.com/dashboards/transaction-coordinator/replication-lag?range=7d&refresh=30s&timezone=Asia%2FTokyo",
    dueDate: null,
    createdAt: new Date("2026-09-15T04:45:00Z"),
    updatedAt: new Date("2026-09-15T04:45:00Z"),
  },
  {
    id: 5,
    title: "旅行の計画",
    body: "三月の連休に京都と奈良を回る。一日目は朝の新幹線で京都に入り、伏見稲荷を午前中に歩いてから、昼は錦市場で食べ歩く。午後は清水寺から八坂神社まで東山を歩き、夜は鴨川の近くの宿に泊まる。二日目は嵐山で竹林と天龍寺を見て、トロッコ列車に乗る。三日目は近鉄で奈良へ移り、東大寺と春日大社を回ってから、ならまちで土産を買って帰る。宿は早めに押さえ、新幹線の指定席は一か月前の発売日に取る。雨の日に備えて、博物館と美術館の開館時間も調べておく。",
    dueDate: "2030-03-20",
    createdAt: new Date("2026-09-20T08:00:00Z"),
    updatedAt: new Date("2026-10-01T10:30:00Z"),
  },
  {
    id: 6,
    title: "歯医者に電話する",
    body: "",
    dueDate: null,
    createdAt: new Date("2026-09-25T23:10:00Z"),
    updatedAt: new Date("2026-09-25T23:10:00Z"),
  },
  {
    id: 7,
    title: "引っ越しの手続き",
    body: "転出届を出し、電気とガスを解約し、郵便の転送を申し込む",
    dueDate: "2030-06-30",
    createdAt: new Date("2026-10-02T03:20:00Z"),
    updatedAt: new Date("2026-10-05T12:00:00Z"),
  },
  {
    id: 8,
    title: "思いついたこと",
    body: "",
    dueDate: null,
    createdAt: new Date("2026-10-06T11:00:00Z"),
    updatedAt: new Date("2026-10-06T11:00:00Z"),
  },
  {
    id: 9,
    title: "請求書の確認",
    body: "先月分の請求書の金額を見積もりと突き合わせる",
    dueDate: "2026-10-10",
    createdAt: new Date("2026-10-09T06:30:00Z"),
    updatedAt: new Date("2026-10-09T06:30:00Z"),
  },
  {
    id: 10,
    title: "週末にやること",
    body: "部屋の掃除と洗濯",
    dueDate: null,
    createdAt: new Date("2026-10-12T01:00:00Z"),
    updatedAt: new Date("2026-10-12T01:00:00Z"),
  },
];

/** notes の行を全部消して見本を入れ直す。何度打っても、行と次に振られる id が同じになる */
export function seedNotes(tx: SeedTransaction): SeededTable {
  tx.delete(notes).run();
  // 消した行の id を sqlite_sequence が覚えたままだと、seed のあとに作る行の id が見本の続きから飛ぶ。
  // sqlite_sequence の書き換えは採番を乱しうる (SQLite「SQLite Autoincrement」) が、表の行を消した
  // あとなので、採番は入れ直した見本の最大の id から続く
  tx.run(sql`delete from sqlite_sequence where name = ${getTableName(notes)}`);
  const { changes } = tx
    .insert(notes)
    .values([...NOTE_SEEDS])
    .run();
  return { table: getTableName(notes), rows: changes };
}
