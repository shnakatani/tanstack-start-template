import { describe, expect, it } from "vite-plus/test";

/**
 * `*.tz.test.ts` が、指定した TZ で実際に走っていることを確かめる。TZ が `Date` に効かないまま
 * 走ると、どの TZ の実行も基準の TZ と同じ結果になり、無言で通る
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)
 */
describe("テストのタイムゾーン", () => {
  const expected = process.env.TEST_TIME_ZONE || process.env.TZ;

  it("Intl の既定のタイムゾーンが TEST_TIME_ZONE (無ければ TZ) になっている", () => {
    // 別名 (Asia/Kolkata と Asia/Calcutta) を同じ名前へそろえてから比べる
    const canonical = new Intl.DateTimeFormat("en", { timeZone: expected }).resolvedOptions()
      .timeZone;
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(canonical);
  });

  it("Date のローカルの時と分が、TEST_TIME_ZONE (無ければ TZ) の壁時計と一致する", () => {
    const instant = new Date("2026-01-15T12:00:00.000Z");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: expected,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(instant);
    const wallClock = ["hour", "minute"].map((type) =>
      Number(parts.find((part) => part.type === type)?.value),
    );
    expect([instant.getHours(), instant.getMinutes()]).toEqual(wallClock);
  });
});
