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

  // POSIX 形式の TZ は Date には効くが Intl が受け付けず、勧めたコマンドが走らない
  test("ホストの TZ が IANA 名でなければ、TEST_TIME_ZONE に渡すようには勧めない", () => {
    const { timeZone, warning } = resolveTestTimeZone({ TZ: "JST-9" });

    expect(timeZone).toBe("America/New_York");
    expect(warning).toContain("TZ=JST-9");
    expect(warning).not.toContain("TEST_TIME_ZONE=JST-9");
  });

  test("TEST_TIME_ZONE があればその TZ にし、ホストの TZ が違っても警告しない", () => {
    expect(resolveTestTimeZone({ TZ: "Asia/Tokyo", TEST_TIME_ZONE: "UTC" })).toStrictEqual({
      timeZone: "UTC",
      warning: undefined,
    });
  });

  // 不正な名前を TZ に入れると、Node は何も言わずに UTC で動き、どの TZ の実行も UTC で通る
  test("TEST_TIME_ZONE が IANA 名でなければ、その値を示して throw する", () => {
    expect(() => resolveTestTimeZone({ TEST_TIME_ZONE: "Asia/Tokio" })).toThrow(
      "TEST_TIME_ZONE=Asia/Tokio",
    );
  });
});
