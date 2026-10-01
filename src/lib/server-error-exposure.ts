import { createSerializationAdapter } from "@tanstack/react-router";

/**
 * production で client へ届く Error の文言。画面には出ない (`route-error.tsx` と `mutation-error.ts` は
 * 固定の文言を出す)。開発者が応答やブラウザの console で見たときに、server のログへ誘導する
 */
export const SERVER_ERROR_MESSAGE = "server で例外が起きました。詳細は server のログにあります";

/**
 * server で起きた例外の詳細 (文言) を client と画面に出すか。DEV だけ出す (ADR-0038)。
 * adapter の登録 (`src/start.ts`) と `route-error.tsx` がここだけを読む。2 か所の判定が食い違うと、
 * server で描いた HTML と client の描画が食い違い、hydration がずれる。
 * 呼んだ時点で読むのは、テストが `vi.stubEnv("DEV", …)` で切り替えられるようにするため
 */
export function exposesServerErrorDetails(): boolean {
  return import.meta.env.DEV;
}

/**
 * Error とそのサブクラスを、文言を持たない汎用の Error として client へ運ぶ (ADR-0038)。
 * 組み込みの直列化は message を運ぶので、drizzle の例外では SQL とユーザーの入力が応答に載る。
 * redirect (`Response`) と notFound (素のオブジェクト) は Error ではないので掴まない
 */
export const serverErrorAdapter = createSerializationAdapter({
  key: "server-error",
  test: (value): value is Error => value instanceof Error,
  toSerializable: () => ({}),
  fromSerializable: () => new Error(SERVER_ERROR_MESSAGE),
});
