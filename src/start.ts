import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { exposesServerErrorDetails, serverErrorAdapter } from "@/lib/server-error-exposure";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * server function の例外を server のログに残して投げ直す。本番の画面は例外の文言を出さず
 * (`src/components/screens/route-error.tsx`)、何もしないと原因がどこにも残らない。
 * redirect と notFound は制御のための throw なので残さない
 */
const logServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    try {
      return await next();
    } catch (error) {
      // どの server function で落ちたかを、スタックを読まずに 1 行目で分かるようにする
      if (!isRedirect(error) && !isNotFound(error)) {
        console.error(`[server fn] ${serverFnMeta.name}`, error);
      }
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [logServerFnErrors],
  // production では server の例外を、文言を持たない Error として client へ運ぶ (ADR-0038)
  serializationAdapters: exposesServerErrorDetails() ? [] : [serverErrorAdapter],
}));
