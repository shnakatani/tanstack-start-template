import { vi } from "vite-plus/test";

/**
 * mock の応答をテスト側で握る。`fn` の実装を未決着の Promise へ差し替え、その resolvers を返す。
 *
 * 即 resolve / 即 reject にすると応答前の中間状態 (pending 表示、楽観行、busy) を観測できない
 * (`.claude/rules/testing.md`「optimistic update テストは遅延 rejection で中間状態を観測」)。
 * 呼び出し側はテストの本文で `resolve()` / `reject()` を呼んで決着の時点を決める。
 */
export function deferMock<TResult>(
  // 引数は握らないので never[] で受ける (どの引数を取る関数でも渡せる)
  fn: (...args: never[]) => Promise<TResult>,
): PromiseWithResolvers<TResult> {
  const deferred = Promise.withResolvers<TResult>();
  vi.mocked(fn).mockImplementation(() => deferred.promise);
  return deferred;
}
