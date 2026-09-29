const BASE_TIME_ZONE = "America/New_York";

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
  if (env.TEST_TIME_ZONE) return { timeZone: env.TEST_TIME_ZONE, warning: undefined };
  // `TZ=Asia/Tokyo vp test run` のように TZ を渡しても効かない。黙って捨てない。
  // ホストが自分の都合で TZ を持つこともあるので、渡した意図は決めつけない。ホストの値は POSIX 形式
  // (JST-9) のこともあり、そのまま TEST_TIME_ZONE に渡すと効かないので勧めない
  const warning =
    env.TZ && env.TZ !== BASE_TIME_ZONE
      ? `[time-zones] ホストの TZ=${env.TZ} は使わず、基準の ${BASE_TIME_ZONE} で走らせる。TZ を変えて走らせるなら TEST_TIME_ZONE に IANA のタイムゾーン名を渡す`
      : undefined;
  return { timeZone: BASE_TIME_ZONE, warning };
}
