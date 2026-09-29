const BASE_TIME_ZONE = "America/New_York";

/**
 * TZ に入れて効く IANA 名か。Intl が受け付けない名前を TZ に入れると、Node は何も言わずに UTC で動く。
 * 大文字小文字だけが違う名前 (`asia/tokyo`) は Intl の検査を通るが、TZ に入れると Intl の既定の TZ が
 * 決まらない (Node 24.21.0、2026-09-29 に実測)。別名 (`US/Eastern`) は既定も決まるので通す
 */
function isIanaTimeZone(timeZone: string): boolean {
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  return canonical === timeZone || canonical.toLowerCase() !== timeZone.toLowerCase();
}

/**
 * テスト全体のタイムゾーンを決める。`vitest.global-setup.ts` がメインプロセスの `TZ` に入れる。
 *
 * 既定は基準の TZ。`TEST_TIME_ZONE` があればそちらにする。`scripts/time-zones/run-tests.ts` が
 * TZ を変えて `*.tz.test.ts` を走らせるときに使う。ホストの `TZ` は使わない。基準の値の選び方は
 * `docs/guides/testing/time-zones.md` にある。
 */
export function resolveTestTimeZone(env: { TZ?: string; TEST_TIME_ZONE?: string }): {
  timeZone: string;
  warning: string | undefined;
} {
  if (env.TEST_TIME_ZONE) {
    // 不正な名前のまま走らせると、どの TZ の実行も UTC で通る。全 project の実行前に落とす
    if (!isIanaTimeZone(env.TEST_TIME_ZONE)) {
      throw new Error(
        `[time-zones] TEST_TIME_ZONE=${env.TEST_TIME_ZONE} は IANA のタイムゾーン名ではない`,
      );
    }
    return { timeZone: env.TEST_TIME_ZONE, warning: undefined };
  }
  // `TZ=Asia/Tokyo vp test run` のように TZ を渡しても効かない。黙って捨てない。
  // ホストが自分の都合で TZ を持つこともあるので、渡した意図は決めつけない
  if (!env.TZ || env.TZ === BASE_TIME_ZONE) return { timeZone: BASE_TIME_ZONE, warning: undefined };
  const retry = isIanaTimeZone(env.TZ)
    ? `${env.TZ} で走らせるなら TEST_TIME_ZONE=${env.TZ} を渡す`
    : "TZ を変えて走らせるなら TEST_TIME_ZONE に IANA のタイムゾーン名を渡す";
  return {
    timeZone: BASE_TIME_ZONE,
    warning: `[time-zones] ホストの TZ=${env.TZ} は使わず、基準の ${BASE_TIME_ZONE} で走らせる。${retry}`,
  };
}
