import { useRef, useTransition } from "react";

/**
 * Action (`startTransition` に渡す非同期関数) を実行し、決着までの再実行を塞ぐ (ADR-0014「Action 層」)。
 *
 * `isPending` は再レンダー後にしか立たないため、同じ tick や再レンダー前に届く再実行は
 * `aria-disabled` では止まらない。ref のフラグで Promise の決着まで塞ぐ。
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
