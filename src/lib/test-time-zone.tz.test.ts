import { describe, expect, it } from "vite-plus/test";

/**
 * `*.tz.test.ts` が、指定した TZ で実際に走っていることを確かめる。TZ が `Date` に効かないまま
 * 走ると、どの TZ の実行も基準の TZ と同じ結果になり、無言で通る
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)
 */
describe("テストのタイムゾーン", () => {
  it("TEST_TIME_ZONE (無ければ TZ) が Date と Intl に効いている", () => {
    const expected = process.env.TEST_TIME_ZONE || process.env.TZ;
    // 別名 (Asia/Kolkata と Asia/Calcutta) を同じ名前へそろえてから比べる
    const canonical = new Intl.DateTimeFormat("en", { timeZone: expected }).resolvedOptions()
      .timeZone;
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(canonical);
  });
});
