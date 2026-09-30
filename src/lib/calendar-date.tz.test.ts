import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDate, isExistingCalendarDate, parseCalendarDate } from "./calendar-date";

/**
 * 暦の日付 (ADR-0031) と Calendar の `Date` の境界を、このプロセスの TZ で確かめる。
 * `toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、UTC より進んだ TZ か遅れた TZ のどちらかで
 * 1 日ずれる (ADR-0031 の Context)
 */
describe("formatCalendarDate", () => {
  it("ローカルの 0 時の Date を同じ年・月・日の文字列にする", () => {
    // Calendar は選んだ日をローカル TZ の 0 時の Date で返す (react-day-picker docs「Setting the Time Zone」)
    expect(formatCalendarDate(new Date(2026, 7, 17))).toBe("2026-08-17");
  });

  it("Invalid Date は RangeError で落ちる (壊れた値を文字列にしない)", () => {
    expect(() => formatCalendarDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("parseCalendarDate", () => {
  it("ローカルの 0 時の Date にする", () => {
    const date = parseCalendarDate("2026-08-17");
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([
      2026, 8, 17, 0,
    ]);
  });

  it.each(["2026-08-17", "2024-02-29"])(
    "%s は formatCalendarDate との往復で変わらない",
    (value) => {
      expect(formatCalendarDate(parseCalendarDate(value))).toBe(value);
    },
  );

  // 2023 年は平年、6 月は 30 日まで。形式違いと時刻つきも暦の日付ではない
  it.each(["2023-02-29", "2023-06-31", "2026-8-7", "2026-08-17T10:00", ""])(
    "%p は throw する",
    (value) => {
      expect(() => parseCalendarDate(value)).toThrow(`暦の日付ではない: ${value}`);
    },
  );
});

describe("isExistingCalendarDate", () => {
  it.each([
    ["2026-08-17", true],
    ["2024-02-29", true],
    ["2023-02-29", false],
    ["2023-06-31", false],
  ] as const)("%s は %s", (value, expected) => {
    expect(isExistingCalendarDate(value)).toBe(expected);
  });
});
