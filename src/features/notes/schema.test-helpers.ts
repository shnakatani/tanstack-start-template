import type { CreatingRow } from "./creating-rows";
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

/** NOTE.createdAt を APP_TIME_ZONE の壁時計で描いた期待値。 */
export const NOTE_CREATED_AT_TEXT = "2026-08-17 09:30";

/** 楽観表示と無効化が対象行だけに効くことを見るための 2 件目。 */
export const OTHER_NOTE: Note = {
  id: 2,
  title: "読書メモ",
  body: "気になった箇所を書き出す",
  createdAt: new Date("2026-08-18T00:30:00.000Z"),
};

/**
 * 追加のテストで保存する 1 件。楽観行は title / body だけを描き、id と createdAt は
 * 再取得後の実データとして使う (保存前のクライアントはこの 2 つを持たない)。
 */
export const CREATED_NOTE: Note = {
  id: 3,
  title: "新しいメモ",
  body: "本文",
  createdAt: new Date("2026-08-19T00:30:00.000Z"),
};

/** CREATED_NOTE を保存中の楽観行として見た形。id と createdAt をまだ持たない */
export const CREATING_ROW: CreatingRow = {
  submittedAt: 1_700_000_000_000,
  variables: { title: CREATED_NOTE.title, body: CREATED_NOTE.body },
};
