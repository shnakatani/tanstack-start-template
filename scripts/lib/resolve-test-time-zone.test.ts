import { describe, expect, test } from "vite-plus/test";

import { resolveTestTimeZone } from "./resolve-test-time-zone";

describe("resolveTestTimeZone", () => {
  test.each([
    { name: "TZ も TEST_TIME_ZONE も無い", env: {} },
    { name: "TZ と TEST_TIME_ZONE が空文字", env: { TZ: "", TEST_TIME_ZONE: "" } },
    { name: "ホストの TZ が基準と同じ", env: { TZ: "America/New_York" } },
  ])("$name なら、基準の TZ にして警告しない", ({ env }) => {
    expect(resolveTestTimeZone(env)).toStrictEqual({
      timeZone: "America/New_York",
      warning: undefined,
    });
  });

  test.each(["Asia/Tokyo", "JST-9"])(
    "ホストの TZ=%s が基準と違えば基準にし、TZ ごとに走らせるスクリプトを警告で案内する",
    (hostTimeZone) => {
      const { timeZone, warning } = resolveTestTimeZone({ TZ: hostTimeZone });

      expect(timeZone).toBe("America/New_York");
      expect(warning).toContain(`TZ=${hostTimeZone}`);
      expect(warning).toContain("vp node scripts/time-zones/run-tests.ts");
      expect(warning).not.toContain(`TEST_TIME_ZONE=${hostTimeZone}`);
    },
  );

  test("TEST_TIME_ZONE があればその TZ にし、ホストの TZ が違っても警告しない", () => {
    expect(resolveTestTimeZone({ TZ: "Asia/Tokyo", TEST_TIME_ZONE: "UTC" })).toStrictEqual({
      timeZone: "UTC",
      warning: undefined,
    });
  });
});
