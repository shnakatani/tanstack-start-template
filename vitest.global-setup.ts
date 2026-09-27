/**
 * テスト全体の基準のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く。ホストの `TZ` に関わらず上書きする。
 *
 * 値は `APP_TIME_ZONE` とも UTC とも違う TZ にする。理由と、テストの中で切り替える方法は
 * `docs/guides/testing/time-zones.md` にある。
 */
export default function setup() {
  process.env.TZ = "America/New_York";
}
