import { useRef, useTransition } from "react";

/**
 * Action (`startTransition` に渡す非同期関数) を実行し、決着までの再実行を塞ぐ (ADR-0014「Action 層」)。
 *
 * 形は React Conf 2025 デモ (rickhanlonii/async-react の `Button.jsx`) の
 * `startTransition(async () => { await action(); })` に、ref のフラグを足したもの。
 * フラグに外部の参考実装は無く、旧 `deleteConfirmMutationProps` (閉包フラグ) の移植。
 *
 * 人間の連打 (別タスク) は、1 回目の後に pending が SyncLane で描画され Base UI の `aria-disabled` が
 * 止める。フラグが要るのは同一タスク内の同期 2 連射 (合成イベント、自動化) で、pending の描画が
 * 2 回目の前に commit されず action が 2 回走る (2026-09-13、`button.test.tsx` の mutant で実測)。
 * Action の reject は握らない。呼び出し側が Action の中で処理し切る。
 */
export function useActionTransition() {
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function run(action: () => Promise<void> | void) {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    startTransition(async () => {
      try {
        await action();
      } finally {
        inFlight.current = false;
      }
    });
  }

  return { isPending, run };
}
