import type { AnyRouter, RegisteredRouter, ValidateNavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouteDialog } from "@/hooks/use-route-dialog";

/**
 * `returnTo` と `findReturnTarget` は `useRouteDialog` へそのまま渡す。`Pick` で `RouteDialogOptions` から
 * 写さないのは、mapped type を通すと `returnTo` から `TOptions` を推論できず、検査が素通りになるため
 */
export interface RoutePendingDialogProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
> {
  title: string;
  returnTo: ValidateNavigateOptions<TRouter, TOptions>;
  findReturnTarget: () => HTMLElement | null;
}

export interface RouteStatusDialogProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
> extends RoutePendingDialogProps<TRouter, TOptions> {
  description: string;
  action?: ReactNode;
}

/**
 * ダイアログの route が、フォームを出せない間 (見つからない、読み込みの失敗) に出すダイアログ (ADR-0041)。
 * 閉じる操作の時点で `returnTo` へ離れる。文言と、閉じる以外の操作 (再試行のボタンなど) は呼ぶ側が渡す。
 * 公開の signature を generic にするのは、`returnTo` を TanStack Router の Type Utilities の
 * `ValidateNavigateOptions` で検査するため (同ガイドの `HeadingLink` の形)。`TRouter` の制約は `useRouteDialog`
 * と同じく `AnyRouter` にする
 */
export function RouteStatusDialog<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown>(
  props: RouteStatusDialogProps<TRouter, TOptions>,
): ReactNode;
export function RouteStatusDialog({
  returnTo,
  findReturnTarget,
  title,
  description,
  action,
}: RouteStatusDialogProps) {
  const { onOpenChange, popupProps } = useRouteDialog({ returnTo, findReturnTarget });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent {...popupProps}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>閉じる</DialogClose>
          {action}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ダイアログの route の読み込み (loader の取得、component の chunk) が `pendingMs` を超えたときに出す
 * (`pendingComponent`、ADR-0041)。開くリンクを押さずに開いた (戻る・進む、URL を直接開いた) ときも、ここで
 * 読み込み中だと分かる。閉じる操作の時点で `returnTo` へ離れ、読み込みは router が打ち切る
 */
export function RoutePendingDialog<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
>(props: RoutePendingDialogProps<TRouter, TOptions>): ReactNode;
export function RoutePendingDialog(props: RoutePendingDialogProps) {
  return <RouteStatusDialog {...props} description="読み込み中" />;
}
