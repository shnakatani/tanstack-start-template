import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { UseMutationResult } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DeleteTarget {
  id: string;
  name: string;
}

/** 削除確認ダイアログの detached trigger を Root に結ぶ handle。消費側の prop 型はこれを使う。 */
export type DeleteDialogHandle = AlertDialogPrimitive.Handle<DeleteTarget>;

/**
 * 削除 mutation を確認ダイアログへ配線する props を組み立てる。
 *
 * 「成功時のみ close し、失敗時はダイアログを開いたまま保持してリトライできる」という契約の
 * 単一実装。消費者ごとに書くと 1 箇所の書き換えで silent に退行するため、ここへ集約する。
 *
 * 二重発火は `disabled` (= `isPending`) では止まらない。isPending が true になるのは
 * mutate 後の再レンダー以降で、連打や Enter + click が同じ tick に届くと 2 回目も
 * disabled=false の DOM に当たる。決着 (`onSettled`) までを閉包のフラグで塞ぐ。
 */
export function deleteConfirmMutationProps(
  handle: DeleteDialogHandle,
  deleteMutation: Pick<UseMutationResult<void, Error, string>, "mutate" | "isPending">,
): {
  handle: DeleteDialogHandle;
  onConfirm: (target: DeleteTarget) => void;
  disabled: boolean;
} {
  let inFlight = false;

  return {
    // handle も返すことで消費側の参照を 1 箇所に閉じる。handle と mutation を別々に渡す形だと
    // 取り違えても型が通り、「削除は走るが閉じない」ダイアログが silent に生まれる。
    handle,
    onConfirm: (target) => {
      // 決着前の再確定は「同じ削除をもう一度頼む」操作で、失われる入力も通知すべき失敗もない。
      // 破棄したことを warn に残すと、正常な連打のたびにログが出る
      if (inFlight) {
        return;
      }
      inFlight = true;
      deleteMutation.mutate(target.id, {
        onSuccess: () => handle.close(),
        onSettled: () => {
          inFlight = false;
        },
      });
    },
    disabled: deleteMutation.isPending,
  };
}

interface DeleteConfirmDialogProps {
  handle: DeleteDialogHandle;
  entityLabel: string;
  /** 既定文言を差し替える場合に指定する (連鎖して消えるものを併記したいとき等)。name は payload の name */
  description?: (name: string) => string;
  onConfirm: (target: DeleteTarget) => void;
  disabled?: boolean;
}

export function DeleteConfirmDialog({
  handle,
  entityLabel,
  description,
  onConfirm,
  disabled,
}: DeleteConfirmDialogProps) {
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
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!payload) {
                  // Trigger 経由なら payload は必ず入る。imperative open 等で欠けた場合に
                  // 無反応で終わらせず、原因を追えるようにする。
                  console.warn("[DeleteConfirmDialog] confirm clicked with no payload", {
                    entityLabel,
                  });
                  return;
                }
                onConfirm(payload);
              }}
              disabled={disabled}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
