import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDateLabel } from "./format-calendar-date-label";

// このファイルは TZ ごとに走らせる (`scripts/time-zones/run-tests.ts`)。どの TZ でも同じ表記になる
describe("formatCalendarDateLabel", () => {
  it("short は 2026/08/07、long は 2026年8月7日", () => {
    expect(formatCalendarDateLabel("2026-08-07", "short")).toBe("2026/08/07");
    expect(formatCalendarDateLabel("2026-08-07", "long")).toBe("2026年8月7日");
  });
});
