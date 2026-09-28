import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDate, parseCalendarDate } from "./calendar-date";

/**
 * 暦の日付 (ADR-0031 の分類 2) と Calendar の `Date` の境界を、このプロセスの TZ で確かめる。
 * `toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、UTC より進んだ TZ か遅れた TZ のどちらかで
 * 1 日ずれる (ADR-0031 の Context)。このファイルは TZ ごとに走らせる (`scripts/time-zones/run-tests.ts`)
 */
describe("formatCalendarDate", () => {
  it("ローカルの 0 時の Date を同じ年・月・日の文字列にする", () => {
    // Calendar は選んだ日をローカル TZ の 0 時の Date で返す (react-day-picker docs「Setting the Time Zone」)
    expect(formatCalendarDate(new Date(2026, 7, 17))).toBe("2026-08-17");
  });
});

describe("parseCalendarDate", () => {
  it("ローカルの 0 時の Date にする", () => {
    const date = parseCalendarDate("2026-08-17");
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([
      2026, 8, 17, 0,
    ]);
  });

  it("formatCalendarDate との往復で値が変わらない", () => {
    expect(formatCalendarDate(parseCalendarDate("2026-08-17"))).toBe("2026-08-17");
  });
});
