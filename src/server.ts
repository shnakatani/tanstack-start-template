import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";

import { logSsrMatchErrors } from "@/server/ssr-errors";

/**
 * custom server entry。描画の前に、SSR の読み込みで error になった match の例外を server のログに残す (ADR-0038)。
 * 包み方は TanStack Start docs「Server Entry Point」の Custom Server Handlers の形
 */
const fetch = createStartHandler(
  defineHandlerCallback((ctx) => {
    logSsrMatchErrors(ctx.router.state.matches);
    return defaultStreamHandler(ctx);
  }),
);

export default createServerEntry({ fetch });
