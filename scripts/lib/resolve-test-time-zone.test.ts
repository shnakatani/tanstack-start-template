import { describe, expect, test } from "vite-plus/test";

import { resolveTestTimeZone } from "./resolve-test-time-zone";

describe("resolveTestTimeZone", () => {
  test.each([
    { name: "TZ も TEST_TIME_ZONE も無い", env: {} },
    { name: "空文字は無いのと同じに扱う", env: { TZ: "", TEST_TIME_ZONE: "" } },
    { name: "ホストの TZ が基準と同じ", env: { TZ: "America/New_York" } },
  ])("$name なら、基準の TZ にして警告しない", ({ env }) => {
    expect(resolveTestTimeZone(env)).toStrictEqual({
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
