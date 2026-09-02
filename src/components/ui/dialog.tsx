import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Popup の配置コンテナ (base-ui 公式 anatomy の Dialog.Viewport)。
 * Dialog / AlertDialog 共通。fixed で画面全体を覆って Popup を中央寄せし、
 * p-4 が Popup と画面端の余白 (上下左右 1rem) を担う。
 */
export const popupViewportLayout =
  "fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4";

/**
 * 内容が viewport 高を超える場合の backstop。Dialog / AlertDialog の
 * Popup 共通。高さの上限は Viewport (popupViewportLayout) の padding 内に収まる
 * max-h-full で制約し、超過分は Popup 全体のスクロールで到達可能にする。
 */
export const popupOverflowBackstop = "max-h-full overflow-y-auto";

// registry 乖離: detached trigger の payload 型を透過するための generic 化。
// base-ui createHandle<Payload> と組で使う。
function Dialog<Payload = unknown>({ ...props }: DialogPrimitive.Root.Props<Payload>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger<Payload = unknown>({ ...props }: DialogPrimitive.Trigger.Props<Payload>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** detached trigger 用 handle を作る (base-ui createHandle の re-export)。1 handle につき Root は 1 つ (複数 Root は非サポートで、後からマウントした Root が状態を引き継いでしまう)。Root を同時に 1 つしか描画されない場所に置き、そこへ向けて Trigger を配る。 */
const createDialogHandle = DialogPrimitive.createHandle;

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport data-slot="dialog-viewport" className={popupViewportLayout}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            // 縦積みは flex column (base-ui 公式の inside-scroll パターンと同型)。ヘッダー・
            // フッターを固定したまま中間要素だけスクロールさせたいダイアログは、共有部品の
            // DialogScrollBody (components/dialog-scroll-body.tsx) で本体を包む。この p-6 を
            // 打ち消して Viewport の内側へ移す実装なので、padding を変えるときは同部品も見る。
            // 内部スクロールを持たないダイアログは、popupOverflowBackstop の overflow-y-auto で
            // DialogContent 全体がスクロールする。backstop スクロール発火時は absolute 配置の
            // X 閉じるボタンもコンテンツと共に流れるため、恒常的に溢れる長大ダイアログを
            // 新設する場合は内部スクロール方式にする。X が流れる挙動は防御層として許容し
            // sticky は作らない (base-ui 公式の outside scroll パターンも X が流れる設計で、
            // sticky 化した独自実装に公式前例がないため)。
            popupOverflowBackstop,
            "relative flex min-h-0 w-full max-w-full flex-col gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button variant="ghost" className="absolute top-4 right-4" size="icon-sm" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  createDialogHandle,
};
