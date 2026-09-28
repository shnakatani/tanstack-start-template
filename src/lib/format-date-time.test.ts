import { describe, expect, it } from "vite-plus/test";

import { APP_TIME_ZONE } from "./format-date-time";

// 壁時計の値を確かめるテストは format-date-time.tz.test.ts にある (TZ ごとに走らせる)
describe("formatDateTime", () => {
  it("基準タイムゾーンを定数として公開する (消費側が壁時計の出所を辿れる)", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Tokyo");
  });
});
