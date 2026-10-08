import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { type RefObject, useRef } from "react";

import { AlertDialogActionButton } from "@/components/action/alert-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { findSiblingRowControl } from "@/lib/find-sibling-row-control";

/**
 * 削除対象。`id` はこの部品では読まず `onConfirm` へそのまま渡すので、消費側の id 型を
 * generic で持つ (string へ変換して往復すると、戻す側で parse し直す羽目になる)。
 */
export interface DeleteTarget<TId = string> {
  id: TId;
  name: string;
}

/** 削除確認ダイアログの detached trigger を Root に結ぶ handle。消費側の prop 型はこれを使う。 */
export type DeleteDialogHandle<TId = string> = AlertDialogPrimitive.Handle<DeleteTarget<TId>>;

interface DeleteConfirmDialogProps<TId> {
  handle: DeleteDialogHandle<TId>;
  entityLabel: string;
  /** 既定文言を差し替える場合に指定する (連鎖して消えるものを併記したいとき等)。name は payload の name */
  description?: (name: string) => string;
  /**
   * 確定時の Action。閉じる時点は ADR-0017 の完了点で選ぶ。確定操作の直後なら handler が `handle.close()`
   * してから mutation を起動する。再取得完了なら `onSuccess` で再取得を await した後に、この部品に
   * 渡した `handle` と同じものを閉じる。
   * 失敗時の扱いは完了点で変わる (確定操作の直後なら閉じた後に toast、再取得完了なら開いたままリトライ)。
   */
  onConfirm: (target: DeleteTarget<TId>) => Promise<void> | void;
  /**
   * 確定したあと閉じるときに、ほかの行に移せる操作が無ければフォーカスを移す先 (一覧への追加ボタンなど)。
   * 移し先の決め方は docs/guides/lists-and-search.md「行を消したあとのフォーカスを移す」
   */
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

export function DeleteConfirmDialog<TId = string>({
  handle,
  entityLabel,
  description,
  onConfirm,
  fallbackFocusRef,
}: DeleteConfirmDialogProps<TId>) {
  const trigger = useRef<Element | null>(null);
  const focusAfterConfirm = useRef<HTMLElement | null>(null);

  function handleOpenChange(open: boolean, details: AlertDialogPrimitive.Root.ChangeEventDetails) {
    if (open) {
      trigger.current = details.trigger ?? null;
      focusAfterConfirm.current = null;
    }
  }

  function confirm(payload: DeleteTarget<TId> | undefined) {
    if (!payload) {
      // Trigger 経由なら payload は必ず入る。imperative open 等で欠けた場合に
      // 無反応で終わらせず、原因を追えるようにする。
      console.warn("[DeleteConfirmDialog] confirm clicked with no payload", { entityLabel });
      return;
    }
    const sibling = trigger.current === null ? null : findSiblingRowControl(trigger.current);
    focusAfterConfirm.current = sibling ?? fallbackFocusRef.current;
    if (focusAfterConfirm.current === null) {
      // 閉じたあとトリガーへ戻り、行と一緒に消えて body へ落ちる
      console.warn("[DeleteConfirmDialog] no focus target after confirm", { entityLabel });
    }
    return onConfirm(payload);
  }

  // 閉じるまでに移し先の行が消えていたら (別の再取得など)、ページが渡す要素へ移す
  function finalFocus() {
    const target = focusAfterConfirm.current;
    if (target === null) {
      return true;
    }
    return target.isConnected ? target : (fallbackFocusRef.current ?? true);
  }

  return (
    <AlertDialog handle={handle} onOpenChange={handleOpenChange}>
      {({ payload }) => (
        <AlertDialogContent finalFocus={finalFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{entityLabel}の削除</AlertDialogTitle>
            <AlertDialogDescription>
              {/* payload は Trigger が open と同時に入れるため、空文字になるのは payload 到着前の
                  一瞬 (描画されない) だけ。payload 欠落そのものは確定時に warn で検出する。 */}
              {payload
                ? (description?.(payload.name) ??
                  `「${payload.name}」を削除しますか？この操作は取り消せません。`)
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogActionButton variant="destructive" action={() => confirm(payload)}>
              削除
            </AlertDialogActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
