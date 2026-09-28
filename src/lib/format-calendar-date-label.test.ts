import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDateLabel } from "./format-calendar-date-label";

/**
 * date-fns の format はロケールのデータ (date-fns/locale/ja の formatLong) から文字列を組む。
 * Intl.DateTimeFormat と違い実装ごとの揺れが無いので、固定の文字列と比べる
 */
describe("formatCalendarDateLabel", () => {
  // 暦に無い日付を Invalid Date のまま整形しない。parseCalendarDate と同じ文言で落ちる
  it("暦に無い 2023-02-29 は parseCalendarDate と同じエラーで throw する", () => {
    expect(() => formatCalendarDateLabel("2023-02-29", "short")).toThrow(
      "暦の日付ではない: 2023-02-29",
    );
  });
});
