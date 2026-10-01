import { createSerializationAdapter } from "@tanstack/react-router";

import { thrownValueMessage } from "./thrown-value-message";

/** production で client が受け取る Error の文言。応答や console を見た開発者を server のログへ案内する */
export const SERVER_ERROR_MESSAGE = "server で例外が起きました。詳細は server のログにあります";

/**
 * server から client へ運ぶ Error を差し替える (ADR-0038)
 * - production: 文言を落とし、client で `SERVER_ERROR_MESSAGE` の Error に戻す
 * - DEV: server の画面と同じ文字列 (`thrownValueMessage`) を運ぶ
 */
export const serverErrorAdapter = createSerializationAdapter<Error, { message?: string }>({
  key: "server-error",
  // どちらか片方では掴み損ねる値があり、Error.isError を持たないブラウザもある (ADR-0038「Error の判定」)
  test: (value): value is Error =>
    (typeof Error.isError === "function" && Error.isError(value)) || value instanceof Error,
  toSerializable: (error) => (import.meta.env.DEV ? { message: thrownValueMessage(error) } : {}),
  fromSerializable: ({ message }) => new Error(message ?? SERVER_ERROR_MESSAGE),
});
