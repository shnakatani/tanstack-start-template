import { useIsFetching, type QueryKey } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";

/**
 * 入力フォームのダイアログの close の制御。保存の応答前は閉じさせず、閉じ終わったらフォームを
 * 作り直す key を進める。返り値の `onOpenChange` と `onOpenChangeComplete` は Dialog の Root へ、
 * `blocksClose` はフォームへ、`formKey` はフォームの key へ渡す。
 *
 * - isPending: 保存の mutation の pending
 * - queryKey: 保存の応答後に再取得するクエリ。再取得中かどうかで応答済みを判別する
 */
export function useSubmitBlockingDialog({
  isPending,
  queryKey,
}: {
  isPending: boolean;
  queryKey: QueryKey;
}) {
  // 再取得中かどうかを hook で読む。`queryClient.isFetching()` を render 中に呼んでも
  // 再描画されず、応答が届いても止めたままになる
  const isRefetching = useIsFetching({ queryKey }) > 0;

  // 止めるのは応答前だけ。閉じて開き直すと onOpenChangeComplete が key を替えてフォームが
  // 作り直され、先行 save の応答が届いた時点で新しい入力ごと閉じる。入力フォームは同じ対象を
  // 開き直しても別の入力になるので、開いている対象と mutation の対象を比べても、先行 save の
  // 応答による close を区別できない。閉じないことで塞ぐ
  // (`docs/guides/updates-and-data.md`「完了点ごとに Transition を終える」の (b))。止めるのは
  // このダイアログだけで、一覧の操作は止めない (ADR-0017「ブロック範囲」)。
  //
  // mutation の pending は応答後も再取得の完了まで続くので、それだけを見ると閉じた後の窓でも
  // true のままになり、開き直したダイアログが閉じられなくなる。再取得中かどうかで応答済みを
  // 判別する。無関係な background refetch と重なると応答前でも通す方向に倒れるが、それは
  // ADR-0017 移行前の従来挙動 (何も止めない) と同じなので、閉じられなくなる側へは倒さない
  const blocksClose = isPending && !isRefetching;

  // 閉じる animation が終わってから作り直す。閉じた瞬間に替えると、消えていく途中の
  // ダイアログの入力が空になって見える。onOpenChangeComplete(false) は Base UI が Portal を
  // unmount するのと同じ callback で呼ばれる。閉じる途中で開き直すと、Portal も unmount されず
  // 入力は残る
  const [formKey, setFormKey] = useState(0);
  function onOpenChangeComplete(open: boolean) {
    if (!open) {
      setFormKey((key) => key + 1);
    }
  }

  // 型は転送先の props から導出する (再宣言すると転送先の型変更に追随しない)
  const onOpenChange: ComponentProps<typeof Dialog>["onOpenChange"] = (open, details) => {
    // 保存の onSuccess の close は handle 経由なので reason が imperative-action になる。通す
    if (!open && blocksClose && details.reason !== "imperative-action") {
      details.cancel();
    }
  };

  return { blocksClose, formKey, onOpenChange, onOpenChangeComplete };
}
