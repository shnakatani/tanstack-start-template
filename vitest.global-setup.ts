/**
 * テスト全体のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く。ホストの `TZ` に関わらず上書きする
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 *
 * 既定は基準の TZ。`TEST_TIME_ZONE` があればそちらにする。`scripts/time-zones/run-tests.ts` が
 * TZ を変えて `*.tz.test.ts` を走らせるときに使う。値の選び方は
 * `docs/guides/testing/time-zones.md` にある。
 */
const BASE_TIME_ZONE = "America/New_York";

export default function setup() {
  const requested = process.env.TEST_TIME_ZONE;
  // `TZ=Asia/Tokyo vp test run` のように TZ を渡しても、基準に上書きされて効かない。黙って上書きしない
  if (!requested && process.env.TZ && process.env.TZ !== BASE_TIME_ZONE) {
    console.warn(
      `[time-zones] TZ=${process.env.TZ} を基準の ${BASE_TIME_ZONE} に上書きする。TZ を変えて走らせるなら TEST_TIME_ZONE を使う`,
    );
  }
  process.env.TZ = requested || BASE_TIME_ZONE;
}
