import { useState, type ComponentProps, type Key } from "react";

import type { Dialog } from "@/components/ui/dialog";

/**
 * 入力フォームのダイアログの close の制御。保存の mutation が pending の間は閉じさせず、閉じ終わったら
 * フォームを作り直す key を進める。返り値の `onOpenChange` と `onOpenChangeComplete` は Dialog の Root へ、
 * `blocksClose` はフォームへ、`formKeyFor(<作り直しの対象>)` の結果はフォームの key へ渡す。
 *
 * - isPending: 保存の mutation の pending
 */
export function useSubmitBlockingDialog({ isPending }: { isPending: boolean }) {
  // 保存の mutation が pending の間は、ユーザー起点の close を止める。止めないと、閉じて開き直した
  // フォームを、先行する保存の onSuccess の close が入力ごと閉じる。入力フォームは同じ対象を
  // 開き直しても別の入力になるので、開いている対象と mutation の対象を比べても区別できない
  // (`docs/guides/react/updates.md`「完了点ごとに Transition を終える」のサーバー応答)。止めるのは
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

  // 対象 (編集する行など) が変わったときも作り直す。useAppForm は defaultValues を作成時に読み、
  // 後から変わった値は入力に触れていないフォームにしか反映されない。閉じる途中で別の対象が届くと、
  // 前の対象の入力が残ったフォームで開く。対象が変わったら key で作り直すのは React docs
  // 「Resetting all state when a prop changes」の形。
  // 対象は Base UI の Dialog が Root の children の render function にしか渡さない (payload) ので、
  // hook の引数では受けられない。render function の中で呼ぶ関数にし、引数を必須にして、対象を
  // 持つダイアログが渡し忘れないようにする。対象を持たないダイアログ (作成) は null を渡す。
  // 閉じている間は payload が無く、フォームを描かないので key も要らない
  function formKeyFor(resetKey: Key | null): string {
    return resetKey === null ? String(generation) : `${generation}-${resetKey}`;
  }

  // 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
  const onOpenChange: ComponentProps<typeof Dialog>["onOpenChange"] = (open, details) => {
    // 保存の onSuccess の close は handle 経由なので reason が imperative-action になる。通す
    if (!open && blocksClose && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return { blocksClose, formKeyFor, onOpenChange, onOpenChangeComplete };
}
