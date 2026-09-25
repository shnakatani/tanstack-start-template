import type { ComponentProps } from "react";

import { ActionForm, type ActionFormProps } from "@/components/action/form";
import { DialogContent } from "@/components/ui/dialog";

type ActionDialogContentProps = Omit<ComponentProps<typeof DialogContent>, "children"> &
  Pick<ActionFormProps, "submitAction" | "children">;

/**
 * フォームを持つダイアログの器。`DialogContent` の中を `ActionForm` で包み、submit を
 * Transition にする (ADR-0016「Action 層」)。見出し・本文・フッターは子として同じ深さに並べる。
 *
 * ```tsx
 * <ActionDialogContent submitAction={save}>
 *   <DialogHeader>…</DialogHeader>
 *   <DialogScrollBody>…</DialogScrollBody>
 *   <DialogFooter><ActionFormSubmit>保存</ActionFormSubmit></DialogFooter>
 * </ActionDialogContent>
 * ```
 *
 * form は `display: contents` で box を作らない。見出し・本文・フッターは Popup の flex の子として
 * 並び、間隔と内部スクロールは Popup (`flex-col gap-6 min-h-0`) が持つ。Base UI の inside scroll
 * (Popup の直下に Header / ScrollArea.Root / Actions) と同じ並びになる。
 *
 * form を `DialogContent` の外に置く形 (shadcn の「With Form」) は採らない。`DialogContent` は
 * Portal で body の下へ出るので、DOM の上で送信ボタンが form の外になり、送信が起きない。
 * Popup を `render` で form として描く形も採らない。Popup は描いた要素に `role="dialog"` を付けるが、
 * ARIA in HTML は form 要素に dialog の役割を許さない。
 *
 * `className` など `submitAction` / `children` 以外の props は `DialogContent` (Popup) へ渡す。
 * form の class は `contents` に固定する。
 */
function ActionDialogContent({
  submitAction,
  children,
  ...contentProps
}: ActionDialogContentProps) {
  return (
    <DialogContent {...contentProps}>
      <ActionForm data-slot="action-dialog-form" submitAction={submitAction} className="contents">
        {children}
      </ActionForm>
    </DialogContent>
  );
}

export { ActionDialogContent, type ActionDialogContentProps };
