import { resolveTestTimeZone } from "./scripts/lib/resolve-test-time-zone";

/**
 * テスト全体のタイムゾーンを決める。worker の起動前にメインプロセスで走るので、pool を
 * 問わず全 project の `Date` に効く (`docs/guides/testing/time-zones.md`「基準を root の globalSetup に置く理由」)
 */
export default function setup() {
  const { timeZone, warning } = resolveTestTimeZone(process.env);
  if (warning) console.warn(warning);
  process.env.TZ = timeZone;
}
