/**
 * 決着を外から制御できる Promise。pending 中の状態を観測するテストで使う。
 * `mockResolvedValue` は microtask で即決着するため中間状態を観測できない
 * (`.claude/rules/testing.md`「optimistic update テストは遅延 rejection で中間状態を観測」)。
 */
export function deferred<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, resolve: settle, reject: fail };
}
