import { createSerializationAdapter } from "@tanstack/react-router";

import { thrownValueMessage } from "./thrown-value-message";

/**
 * production で client へ届く Error の文言。画面には出ない (`route-error.tsx` と `mutation-error.ts` は
 * 固定の文言を出す)。開発者が応答やブラウザの console で見たときに、server のログへ誘導する
 */
export const SERVER_ERROR_MESSAGE = "server で例外が起きました。詳細は server のログにあります";

/**
 * server で起きた例外の詳細 (文言) を client と画面に出すか。DEV だけ出す (ADR-0038)。
 * `serverErrorAdapter` と `route-error.tsx` がここだけを読む。2 か所の判定が食い違うと、
 * server で描いた HTML と client の描画が食い違い、hydration がずれる。
 * 呼んだ時点で読むのは、テストが `vi.stubEnv("DEV", …)` で切り替えられるようにするため
 */
export function exposesServerErrorDetails(): boolean {
  return import.meta.env.DEV;
}

/**
 * Error とそのサブクラスを client へ運ぶ (ADR-0038)。production では元の文言を落とし、client では
 * `SERVER_ERROR_MESSAGE` の Error に復元する。DEV では、server で描く画面が出すのと同じ文字列
 * (`thrownValueMessage`) を運ぶ。message をそのまま運ぶと、message が空のサブクラスなどで server と
 * client の描画が食い違い、直列化できない message では dehydrate が落ちる。組み込みの直列化は message を
 * 運ぶので、差し替えないとアプリが投げた文言と SQLite の文言 (テーブル名や列名を含む) が応答に載る。
 * redirect (`Response`) と notFound (素のオブジェクト) は Error ではないので掴まない
 */
export const serverErrorAdapter = createSerializationAdapter<Error, { message?: string }>({
  key: "server-error",
  test: (value): value is Error => value instanceof Error,
  toSerializable: (error) =>
    exposesServerErrorDetails() ? { message: thrownValueMessage(error) } : {},
  fromSerializable: ({ message }) => new Error(message ?? SERVER_ERROR_MESSAGE),
});
