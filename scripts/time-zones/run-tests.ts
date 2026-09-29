import { spawnSync } from "node:child_process";

/**
 * `*.tz.test.ts` を TZ ごとに別のプロセスで走らせる。基準の TZ (`vitest.global-setup.ts`) では
 * `vp test run` が走らせるので、ここでは残りを走らせる。
 *
 * テストの中で `TZ` を変えても、threads と vmThreads の pool では `Date` に効かない
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 * プロセスごとに決めれば pool を問わず効く。
 *
 * 暦の日付は、`toISOString()` や `new Date("YYYY-MM-DD")` を挟むと、UTC より進んだ TZ か
 * 遅れた TZ のどちらかで 1 日ずれる (ADR-0031 の Context)。両側と日付変更線の際を並べる。
 */
const TIME_ZONES = [
  "UTC",
  // UTC+9
  "Asia/Tokyo",
  // UTC+5:30。時単位でないオフセット
  "Asia/Kolkata",
  // UTC+14。進んだ側の端
  "Pacific/Kiritimati",
  // UTC-11。遅れた側の端
  "Pacific/Pago_Pago",
] as const;

for (const timeZone of TIME_ZONES) {
  console.log(`\n[time-zones] TEST_TIME_ZONE=${timeZone}`);
  const result = spawnSync("vp", ["test", "run", "--project", "unit", ".tz.test.ts"], {
    stdio: "inherit",
    env: { ...process.env, TEST_TIME_ZONE: timeZone },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`[time-zones] ${timeZone} で失敗した`, {
      status: result.status,
      signal: result.signal,
    });
    process.exit(result.status ?? 1);
  }
}
