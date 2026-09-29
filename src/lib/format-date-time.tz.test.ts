import { describe, expect, it } from "vite-plus/test";

import { formatDateTime } from "./format-date-time";

/**
 * SSR する画面の日時整形が実行環境のローカルタイムゾーンに依存しないことを固定する。
 * 依存すると SSR (サーバーの TZ) と hydration (ブラウザの TZ) で別の文字列になり、
 * TZ が食い違う環境でだけ hydration mismatch が出る。
 *
 * このファイルは TZ ごとの project (`vitest.config.ts`) でも走り、どの TZ でも同じ壁時計を返すことを確かめる。
 *
 * 出力の文字列そのものは固定値と比べない。区切りや空白はロケールのデータが決め、実装ごとに
 * 違ってよい (MDN「Intl.DateTimeFormat.prototype.format()」の Note)。比べるのは数字の並びだけ。
 */

/** 整形した文字列から数字の並び (年・月・日・時・分) を取り出す。 */
function wallClockOf(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

describe("formatDateTime", () => {
  it("基準タイムゾーンの壁時計を年・月・日・時・分で返す", () => {
    // 2026-08-17T00:30Z は Asia/Tokyo (UTC+9) の 09:30
    expect(wallClockOf(formatDateTime(new Date("2026-08-17T00:30:00.000Z")))).toEqual([
      2026, 8, 17, 9, 30,
    ]);
  });

  it("基準タイムゾーンで日付が繰り上がる時刻は、翌日の 0 時として返す", () => {
    // 2026-01-01T15:00Z + 9h = 翌日 00:00。24 時とは書かない
    expect(wallClockOf(formatDateTime(new Date("2026-01-01T15:00:00.000Z")))).toEqual([
      2026, 1, 2, 0, 0,
    ]);
  });

  it("午後の時刻を 24 時間制で返す", () => {
    // 2026-08-17T06:30Z は Asia/Tokyo の 15:30。12 時間制なら 3 時になる
    expect(wallClockOf(formatDateTime(new Date("2026-08-17T06:30:00.000Z")))).toEqual([
      2026, 8, 17, 15, 30,
    ]);
  });
});
