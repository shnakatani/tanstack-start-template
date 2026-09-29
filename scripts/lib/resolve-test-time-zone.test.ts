import { describe, expect, test } from "vite-plus/test";

import { resolveTestTimeZone } from "./resolve-test-time-zone";

describe("resolveTestTimeZone", () => {
  test("TZ も TEST_TIME_ZONE も無ければ、基準の TZ にして警告しない", () => {
    expect(resolveTestTimeZone({})).toStrictEqual({
      timeZone: "America/New_York",
      warning: undefined,
    });
  });

  test("空文字は無いのと同じに扱う", () => {
    expect(resolveTestTimeZone({ TZ: "", TEST_TIME_ZONE: "" })).toStrictEqual({
      timeZone: "America/New_York",
      warning: undefined,
    });
  });

  test("ホストの TZ が基準と同じなら警告しない", () => {
    expect(resolveTestTimeZone({ TZ: "America/New_York" })).toStrictEqual({
      timeZone: "America/New_York",
      warning: undefined,
    });
  });

  test("ホストの TZ が基準と違えば基準にし、その TZ で走らせるコマンドを警告に載せる", () => {
    const { timeZone, warning } = resolveTestTimeZone({ TZ: "Asia/Tokyo" });

    expect(timeZone).toBe("America/New_York");
    expect(warning).toContain("TZ=Asia/Tokyo");
    expect(warning).toContain("TEST_TIME_ZONE=Asia/Tokyo");
  });

  test("TEST_TIME_ZONE があればその TZ にし、ホストの TZ が違っても警告しない", () => {
    expect(resolveTestTimeZone({ TZ: "Asia/Tokyo", TEST_TIME_ZONE: "UTC" })).toStrictEqual({
      timeZone: "UTC",
      warning: undefined,
    });
  });
});
