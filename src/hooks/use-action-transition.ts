import { useTransition } from "react";

/**
 * Action (`startTransition` に渡す非同期関数) を Transition の中で await して実行する
 * (ADR-0014「Action 層」。形は React Conf 2025 デモ rickhanlonii/async-react の `Button.jsx` と同じ)。
 *
 * 決着前の二重発火は `isPending` で塞ぐ (react.dev の useTransition / useFormStatus が示す
 * `disabled={pending}` の形)。React はユーザーイベントごとに次のイベントより前へ DOM 更新を終える
 * (reactwg/react-18 discussions#21) ので、2 回目の実イベントは `aria-disabled` の部品に届き Base UI が
 * click を止める (2026-09-13、`button.test.tsx` の実イベント 2 連射で実測)。ref や閉包のフラグは持たない。
 * Action の reject は握らない。呼び出し側が Action の中で処理し切る。
 */
export function useActionTransition() {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void> | void) {
    startTransition(async () => {
      await action();
    });
  }

  return { isPending, run };
}
