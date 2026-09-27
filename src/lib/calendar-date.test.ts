import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { formatCalendarDate, isExistingCalendarDate, parseCalendarDate } from "./calendar-date";
import { TIME_ZONES } from "./calendar-date.test-helpers";

describe("formatCalendarDate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(TIME_ZONES)(
    "%s で、ローカルの 0 時の Date を同じ年・月・日の文字列にする",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone);
      // Calendar は選んだ日をローカル TZ の 0 時の Date で返す (react-day-picker docs「Setting the Time Zone」)
      expect(formatCalendarDate(new Date(2026, 7, 17))).toBe("2026-08-17");
    },
  );

  it("Invalid Date は RangeError で落ちる (壊れた値を文字列にしない)", () => {
    expect(() => formatCalendarDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("parseCalendarDate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(TIME_ZONES)("%s で、ローカルの 0 時の Date にする", (timeZone) => {
    vi.stubEnv("TZ", timeZone);
    const date = parseCalendarDate("2026-08-17");
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([
      2026, 8, 17, 0,
    ]);
  });

  it.each(TIME_ZONES)("%s で、formatCalendarDate との往復で値が変わらない", (timeZone) => {
    vi.stubEnv("TZ", timeZone);
    expect(formatCalendarDate(parseCalendarDate("2026-08-17"))).toBe("2026-08-17");
  });

  it("うるう年の 2024-02-29 は読める", () => {
    expect(formatCalendarDate(parseCalendarDate("2024-02-29"))).toBe("2024-02-29");
  });

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
