import { formatDateTime } from "@/lib/format-date-time";

import type { CreatingRow } from "./creating-rows";
import type { Note } from "./schema";

/**
 * テスト用の確定済みメモ。createdAt は絶対時刻 (UTC) で固定し、期待値が実行環境のローカル TZ で
 * 動かないようにする (2026-08-17T00:30Z = JST 09:30、画面は APP_TIME_ZONE の壁時計で描く)。
 * updatedAt は createdAt と違う値にする。同じだと、一覧の行で 2 つの日時の cell が同じ文字列になり、
 * 文字列で cell を取れない。
 */
export const NOTE: Note = {
  id: 1,
  title: "買い物リスト",
  body: "牛乳とパンを買う",
  dueDate: "2026-08-20",
  createdAt: new Date("2026-08-17T00:30:00.000Z"),
  updatedAt: new Date("2026-08-17T02:00:00.000Z"),
};

/**
 * NOTE.createdAt を画面に描いた期待値。整形の結果を固定値で持たず、`formatDateTime` から作る。
 * 区切りや空白はロケールのデータが決め、実装ごとに違ってよい (MDN「Intl.DateTimeFormat.prototype.format()」
 * の Note)。壁時計の値が正しいことは `src/lib/format-date-time.test.ts` が見る。
 */
export const NOTE_CREATED_AT_TEXT = formatDateTime(NOTE.createdAt);

/** NOTE.updatedAt を画面に描いた期待値。作り方は NOTE_CREATED_AT_TEXT と同じ */
export const NOTE_UPDATED_AT_TEXT = formatDateTime(NOTE.updatedAt);

/**
 * NOTE を編集して保存した後の姿。id と createdAt は NOTE のまま、title と updatedAt だけが変わる。
 * 更新中の行は入力項目 (title / body / dueDate) を描き、updatedAt は再取得後の実データとして使う。
 */
export const UPDATED_NOTE: Note = {
  ...NOTE,
  title: "買い出しリスト",
  updatedAt: new Date("2026-08-19T03:00:00.000Z"),
};

/** 楽観表示と無効化が対象行だけに効くことを見るための 2 件目。 */
export const OTHER_NOTE: Note = {
  id: 2,
  title: "読書メモ",
  body: "気になった箇所を書き出す",
  dueDate: null,
  createdAt: new Date("2026-08-18T00:30:00.000Z"),
  // NOTE と同じく createdAt と違う値にする
  updatedAt: new Date("2026-08-18T02:00:00.000Z"),
};

/**
 * 追加のテストで保存する 1 件。楽観行は入力項目 (title / body / dueDate) だけを描き、id・createdAt・
 * updatedAt は再取得後の実データとして使う (保存前のクライアントはこの 3 つを持たない)。
 */
export const CREATED_NOTE: Note = {
  id: 3,
  title: "新しいメモ",
  body: "本文",
  dueDate: "2026-08-21",
  createdAt: new Date("2026-08-19T00:30:00.000Z"),
  updatedAt: new Date("2026-08-19T00:30:00.000Z"),
};

/** CREATED_NOTE を保存中の楽観行として見た形。id・createdAt・updatedAt をまだ持たない */
export const CREATING_ROW: CreatingRow = {
  submittedAt: 1_700_000_000_000,
  variables: { title: CREATED_NOTE.title, body: CREATED_NOTE.body, dueDate: CREATED_NOTE.dueDate },
};
