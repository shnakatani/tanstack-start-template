/**
 * 暦の日付 (ADR-0031 の分類 2) と Calendar の `Date` の境界を、UTC より進んだ TZ と遅れた TZ で
 * 固定する。`toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、どちらかの側で 1 日ずれる
 * (ADR-0031 の Context)。基準は vitest.global-setup.ts の America/New_York (UTC-4/-5)。
 * Asia/Tokyo (UTC+9) と Pacific/Kiritimati (UTC+14) は進んだ側、Pacific/Pago_Pago (UTC-11) は遅れた側
 */
export const TIME_ZONES = [
  "America/New_York",
  "UTC",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;
