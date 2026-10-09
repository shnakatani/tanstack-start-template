import { useState, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";

// 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
type DialogOpenChange = NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]>;

/**
 * 保存の pending の間に止める close か。止めるのは利用者の close だけにする。handle で閉じた close
 * (reason が imperative-action) は保存の onSuccess なので通す。止めたら呼び出し側が `details.cancel()` する
 */
export function blocksUserClose(
  nextOpen: boolean,
  details: Parameters<DialogOpenChange>[1],
  blocksClose: boolean,
): boolean {
  return !nextOpen && blocksClose && details.reason !== "imperative-action";
}

/**
 * handle で開き、閉じても mount したままの入力フォームのダイアログ (作成) の close の制御。保存の mutation が
 * pending の間は利用者の close を止め、閉じ終わるたびにフォームを作り直す。
 * 返り値の `blocksClose` はフォームへ、`onOpenChange` と `onOpenChangeComplete` は Dialog の Root へ、
 * `formKey` はフォームの key へ渡す。route として開くダイアログは `useRouteDialog` を使う。
 *
 * - isPending: 保存の mutation の pending
 */
export function useSubmitBlockingDialog({ isPending }: { isPending: boolean }) {
  // 保存の mutation が pending の間は、ユーザー起点の close を止める。止めないと、閉じて開き直した
  // フォームを、先行する保存の onSuccess の close が入力ごと閉じる。入力フォームは開き直すと別の入力に
  // なるので、mutation の対象と比べても区別できない (`docs/guides/react/updates.md`「完了点ごとに
  // Transition を終える」のサーバー応答)。止めるのはこのダイアログだけで、一覧の操作は止めない
  // (ADR-0017「ブロック範囲」)。
  //
  // pending は応答後も再取得の完了まで続くので、その間に開き直したダイアログも閉じられない。
  // TanStack Query は「応答は届いたが onSuccess の途中」を公開の状態で持たない。再取得中かどうかから
  // 推定すると、先行する保存の再取得と重なったときに応答前でも通ってしまう
  const blocksClose = isPending;

  // 閉じる animation が終わってから作り直す。閉じた瞬間に替えると、消えていく途中の
  // ダイアログの入力が空になって見える。onOpenChangeComplete(false) は Base UI が Portal を
  // unmount するのと同じ callback で呼ばれる。閉じる途中で開き直すと、Portal も unmount されず
  // 入力は残る
  const [generation, setGeneration] = useState(0);
  function onOpenChangeComplete(open: boolean) {
    if (!open) {
      setGeneration((current) => current + 1);
    }
  }

  const formKey = String(generation);

  const onOpenChange: DialogOpenChange = (open, details) => {
    if (blocksUserClose(open, details, blocksClose)) {
      details.cancel();
    }
  };

  return { blocksClose, formKey, onOpenChange, onOpenChangeComplete };
}
