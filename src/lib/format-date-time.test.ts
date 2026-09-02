import { afterEach, describe, expect, it } from "vite-plus/test";

import { APP_TIME_ZONE, formatDateTime } from "./format-date-time";

/**
 * SSR する画面の日時整形が実行環境のローカルタイムゾーンに依存しないことを固定する。
 * 依存すると SSR (サーバーの TZ) と hydration (ブラウザの TZ) で別の文字列になり、
 * TZ が食い違う環境でだけ hydration mismatch が出る。
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

describe("formatDateTime", () => {
  it("基準タイムゾーンの壁時計を yyyy-MM-dd HH:mm で返す", () => {
    // 2026-08-17T00:30Z は Asia/Tokyo (UTC+9) の 09:30
    expect(formatDateTime(new Date("2026-08-17T00:30:00.000Z"))).toBe("2026-08-17 09:30");
  });

  it("基準タイムゾーンで日付が繰り上がる時刻も繰り上げて返す", () => {
    // 2026-01-01T15:00Z + 9h = 翌日 00:00
    expect(formatDateTime(new Date("2026-01-01T15:00:00.000Z"))).toBe("2026-01-02 00:00");
  });

  it("1 桁の月日時分をゼロ埋めする", () => {
    expect(formatDateTime(new Date("2026-03-04T00:05:00.000Z"))).toBe("2026-03-04 09:05");
  });

  it("ホストのローカル TZ を変えても同じ文字列を返す", () => {
    const instant = new Date("2026-08-17T00:30:00.000Z");

    process.env.TZ = "UTC";
    const onUtcHost = formatDateTime(instant);
    process.env.TZ = "America/New_York";
    const onNewYorkHost = formatDateTime(instant);

    expect(onUtcHost).toBe(onNewYorkHost);
    expect(onUtcHost).toBe("2026-08-17 09:30");
  });

  it("基準タイムゾーンを定数として公開する (消費側が壁時計の出所を辿れる)", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Tokyo");
  });
});
