import { ActionButton, type ActionButtonProps } from "@/components/action/button";

/**
 * 確認ダイアログの確定ボタン。registry の `AlertDialogAction` (`ui/alert-dialog.tsx`) と同じ
 * `data-slot` を持ち、`action` prop で Transition 化する (ADR-0021)。
 */
function AlertDialogActionButton(props: ActionButtonProps) {
  return <ActionButton data-slot="alert-dialog-action" {...props} />;
}

export { AlertDialogActionButton };
