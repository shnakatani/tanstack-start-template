const BASE_TIME_ZONE = "America/New_York";

/** Intl が IANA 名として受け付けるか。受け付けない名前を TZ に入れると、Node は何も言わずに UTC で動く */
function isIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
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
