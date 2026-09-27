import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  formatCalendarDate,
  formatCalendarDateLabel,
  isExistingCalendarDate,
  parseCalendarDate,
} from "./calendar-date";

/**
 * 暦の日付 (ADR-0031 の分類 2) と Calendar の `Date` の境界を、UTC より進んだ TZ と遅れた TZ で
 * 固定する。`toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、どちらかの側で 1 日ずれる
 * (ADR-0031 の Context)。基準は vitest.global-setup.ts の America/New_York (UTC-4/-5)。
 * Asia/Tokyo (UTC+9) と Pacific/Kiritimati (UTC+14) は進んだ側、Pacific/Pago_Pago (UTC-11) は遅れた側
 */
const TIME_ZONES = [
  "America/New_York",
  "UTC",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;

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

/**
 * date-fns の format はロケールのデータ (date-fns/locale/ja の formatLong) から文字列を組む。
 * Intl.DateTimeFormat と違い実装ごとの揺れが無いので、固定の文字列と比べる
 */
describe("formatCalendarDateLabel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(TIME_ZONES)("%s でも、short は 2026/08/07、long は 2026年8月7日", (timeZone) => {
    vi.stubEnv("TZ", timeZone);
    expect(formatCalendarDateLabel("2026-08-07", "short")).toBe("2026/08/07");
    expect(formatCalendarDateLabel("2026-08-07", "long")).toBe("2026年8月7日");
  });

  // 暦に無い日付を Invalid Date のまま整形しない。parseCalendarDate と同じ文言で落ちる
  it("暦に無い 2023-02-29 は parseCalendarDate と同じエラーで throw する", () => {
    expect(() => formatCalendarDateLabel("2023-02-29", "short")).toThrow(
      "暦の日付ではない: 2023-02-29",
    );
  });
});
