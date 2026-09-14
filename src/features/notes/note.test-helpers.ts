import type { Note } from "./schema";

/**
 * テスト用の確定済みメモ。createdAt は絶対時刻 (UTC) で固定し、期待値が実行環境のローカル TZ で
 * 動かないようにする (2026-08-17T00:30Z = JST 09:30、画面は APP_TIME_ZONE の壁時計で描く)。
 */
export const NOTE: Note = {
  id: 1,
  title: "買い物リスト",
  body: "牛乳とパンを買う",
  createdAt: new Date("2026-08-17T00:30:00.000Z"),
};

/** 楽観表示と無効化が対象行だけに効くことを見るための 2 件目。 */
export const OTHER_NOTE: Note = {
  id: 2,
  title: "読書メモ",
  body: "気になった箇所を書き出す",
  createdAt: new Date("2026-08-18T00:30:00.000Z"),
};
