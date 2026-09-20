/**
 * 決着の時点をテスト本文 (story なら play) が握る action の実装を作る。
 *
 * 実時間へ預ける形 (`setTimeout`) は、決着が次の操作より先に届いた回で偽 red になる
 * (testing.md「optimistic update テストは遅延 rejection で中間状態を観測」)。
 *
 * Storybook の vitest 実行は 1 つの React root へ story を描き替えるため、決着しない
 * Transition が残ると後続 story と干渉する (ADR-0022)。`beforeEach` は開始時と終了時の
 * 両方で全決着させるので、play が `settle()` の手前で落ちても、teardown が走らないまま
 * 再描画されても持ち越さない。
 *
 * `storybook/test` の `fn` へは渡す側で包む。ここが mock ライブラリに依存しないので、
 * 呼び出し側は story でもブラウザテストでも使える。
 *
 * ```ts
 * const settling = createSettlingAction();
 * const meta = {
 *   args: { action: fn(settling.impl) },
 *   beforeEach: settling.beforeEach,
 * } satisfies Meta<typeof ActionButton>;
 * ```
 */
export interface SettlingAction {
  /** `fn()` へ渡す実装。呼ぶたびに未決着の Promise を 1 本作る */
  impl: () => Promise<undefined>;
  /** いま未決着のものを全て決着させる */
  settle: () => void;
  /** `meta.beforeEach` へ渡す。開始時に持ち越しを決着させ、終了時にも全決着させる */
  beforeEach: () => () => void;
}

export function createSettlingAction(): SettlingAction {
  let pendingResolvers: Array<() => void> = [];

  function settle(): void {
    // 決着済みを持ち越さないよう、走らせる前に入れ替える
    const resolvers = pendingResolvers;
    pendingResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  return {
    impl: () => {
      // void を型引数に置くと no-invalid-void-type が落ちる。Promise<undefined> は
      // action の戻り値 Promise<void> へそのまま渡せる
      const { promise, resolve } = Promise.withResolvers<undefined>();
      pendingResolvers.push(() => {
        resolve(undefined);
      });
      return promise;
    },
    settle,
    beforeEach: () => {
      // 持ち越しは捨てずに決着させる。捨てると、その Promise を待っている Transition が
      // 永久に pending のまま残る。持ち越しがあること自体が teardown の取りこぼしなので
      // 残す (UI で control を変えると rerender が beforeEach を再走させ、押下中の分が
      // 持ち越される)
      if (pendingResolvers.length > 0) {
        console.warn("[settling-action] 前の描画の未決着を決着させてから始める", {
          carriedOver: pendingResolvers.length,
        });
      }
      settle();
      return settle;
    },
  };
}
