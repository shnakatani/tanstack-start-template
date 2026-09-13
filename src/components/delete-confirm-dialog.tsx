import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

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
   * 確定時の Action。mutation なら `useActionMutation` の `runAction` を渡し、成功時の close は
   * mutation の `onSuccess` が再取得を await した後に `handle.close()` で行う (ADR-0014)。
   * 成功時の close はこの部品に渡した `handle` と同じものを呼ぶ。別の handle を閉じても型は通り、
   * 削除は走るが閉じないダイアログになる。
   * 失敗時は閉じないので、開いたままリトライできる。
   */
  onConfirm: (target: DeleteTarget<TId>) => Promise<void> | void;
}

export function DeleteConfirmDialog<TId = string>({
  handle,
  entityLabel,
  description,
  onConfirm,
}: DeleteConfirmDialogProps<TId>) {
  return (
    <AlertDialog handle={handle}>
      {({ payload }) => (
        <AlertDialogContent>
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
            <AlertDialogActionButton
              variant="destructive"
              pendingLabel="削除中"
              action={async () => {
                if (!payload) {
                  // Trigger 経由なら payload は必ず入る。imperative open 等で欠けた場合に
                  // 無反応で終わらせず、原因を追えるようにする。
                  console.warn("[DeleteConfirmDialog] confirm clicked with no payload", {
                    entityLabel,
                  });
                  return;
                }
                await onConfirm(payload);
              }}
            >
              削除
            </AlertDialogActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
