import { useState, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";

/**
 * 入力フォームのダイアログの close の制御。保存の mutation が pending の間は利用者の close を止める。
 * 返り値の `blocksClose` はフォームへ、`onOpenChange` は Dialog の Root へ渡す。
 *
 * handle で開き、閉じても mount したままのダイアログ (作成) は、`onOpenChangeComplete` も Root へ、
 * `formKey` をフォームの key へ渡し、閉じ終わるたびにフォームを作り直す。route として開くダイアログ
 * (編集) は閉じると route ごと unmount し、開くたびにフォームを作るので、この 2 つを使わない。
 *
 * - isPending: 保存の mutation の pending
 */
export function useSubmitBlockingDialog({ isPending }: { isPending: boolean }) {
  // 保存の mutation が pending の間は、ユーザー起点の close を止める。閉じても mount したままの
  // ダイアログ (作成) で止めないと、閉じて開き直したフォームを、先行する保存の onSuccess の close が
  // 入力ごと閉じる。入力フォームは開き直すと別の入力になるので、mutation の対象と比べても区別できない
  // (`docs/guides/react/updates.md`「完了点ごとに Transition を終える」のサーバー応答)。route として
  // 開くダイアログ (編集) は開くたびに mount し直すのでこの取り違えは起きないが、応答の前に閉じると、
  // 保存に失敗したときに入力が残らない (完了点「サーバー応答」、ADR-0017)。止めるのは
  // このダイアログだけで、一覧の操作は止めない (ADR-0017「ブロック範囲」)。
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

  // 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
  const onOpenChange: NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]> = (
    open,
    details,
  ) => {
    // 作成の保存の onSuccess は handle で閉じるので、reason が imperative-action になる。通す。
    // 編集の保存の onSuccess は open を false にするだけで、ここを通らない
    if (!open && blocksClose && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return { blocksClose, formKey, onOpenChange, onOpenChangeComplete };
}
