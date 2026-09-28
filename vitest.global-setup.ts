/**
 * テスト全体のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く。ホストの `TZ` に関わらず上書きする
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 *
 * 既定は基準の TZ。`TEST_TIME_ZONE` があればそちらにする。`scripts/time-zones/run-tests.ts` が
 * TZ を変えて `*.tz.test.ts` を走らせるときに使う。値の選び方は
 * `docs/guides/testing/time-zones.md` にある。
 */
export default function setup() {
  process.env.TZ = process.env.TEST_TIME_ZONE || "America/New_York";
}
