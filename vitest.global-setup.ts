import { resolveTestTimeZone } from "./scripts/lib/resolve-test-time-zone";

/**
 * テスト全体のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く
 * (https://vitest.dev/guide/common-errors#time-zone-does-not-change-in-worker-threads)。
 * どの TZ にするかは `resolveTestTimeZone` が決める。
 */
export default function setup() {
  const { timeZone, warning } = resolveTestTimeZone(process.env);
  if (warning) console.warn(warning);
  process.env.TZ = timeZone;
}
