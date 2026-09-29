/**
 * テスト全体の基準のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く。ホストの `TZ` に関わらず上書きする
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 *
 * TZ を変えて走らせる project は、`vitest.config.ts` で `test.env` の `TZ` を持つ。値の選び方は
 * `docs/guides/testing/time-zones.md` にある。
 */
export default function setup() {
  process.env.TZ = "America/New_York";
}
