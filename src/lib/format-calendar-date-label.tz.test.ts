import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDateLabel } from "./format-calendar-date-label";

/**
 * どの TZ でも同じ表記になることを確かめる。
 *
 * date-fns の format はロケールのデータ (date-fns/locale/ja の formatLong) から文字列を組む。
 * Intl.DateTimeFormat と違い実装ごとの揺れが無いので、固定の文字列と比べる
 */
describe("formatCalendarDateLabel", () => {
  it("short は 2026/08/07、long は 2026年8月7日", () => {
    expect(formatCalendarDateLabel("2026-08-07", "short")).toBe("2026/08/07");
    expect(formatCalendarDateLabel("2026-08-07", "long")).toBe("2026年8月7日");
  });
});
