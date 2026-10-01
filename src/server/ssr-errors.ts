import type { AnyRouteMatch } from "@tanstack/react-router";

type SsrMatch = { routeId: string; status: AnyRouteMatch["status"]; error: unknown };

/**
 * SSR の読み込みで error になった match の例外を server のログに残す (ADR-0038)。
 * router は loader / beforeLoad の例外を route の `onError` に渡すだけで console に出さず、server では
 * errorComponent をそのまま描くので、ここで出さないとどこにも残らない。
 * server function の中で起きた例外は `logServerFnErrors` (`src/start.ts`) も残すので、SSR の loader から
 * 呼んだ server function の例外は 2 行になる (`docs/guides/server-errors.md`「例外を server のログに残す」)
 */
export function logSsrMatchErrors(matches: ReadonlyArray<SsrMatch>): void {
  for (const match of matches) {
    switch (match.status) {
      case "error":
        console.error(`[ssr] ${match.routeId}`, match.error);
        break;
      // notFound は 404 を出すための制御の throw。pending と success は例外を持たない
      case "notFound":
      case "pending":
      case "success":
        break;
      default: {
        const unhandled: never = match.status;
        throw new Error(`unhandled match status: ${String(unhandled)}`);
      }
    }
  }
}
