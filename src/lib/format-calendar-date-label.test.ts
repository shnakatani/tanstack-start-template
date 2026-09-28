import { describe, expect, it } from "vite-plus/test";

import { formatCalendarDateLabel } from "./format-calendar-date-label";

// 整形した文字列の値は format-calendar-date-label.tz.test.ts が TZ ごとに確かめる
describe("formatCalendarDateLabel", () => {
  // 暦に無い日付を Invalid Date のまま整形しない。parseCalendarDate と同じ文言で落ちる
  it("暦に無い 2023-02-29 は parseCalendarDate と同じエラーで throw する", () => {
    expect(() => formatCalendarDateLabel("2023-02-29", "short")).toThrow(
      "暦の日付ではない: 2023-02-29",
    );
  });
});
