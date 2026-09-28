import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDate, isExistingCalendarDate, parseCalendarDate } from "./calendar-date";

describe("formatCalendarDate", () => {
  it("Invalid Date は RangeError で落ちる (壊れた値を文字列にしない)", () => {
    expect(() => formatCalendarDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("parseCalendarDate", () => {
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
