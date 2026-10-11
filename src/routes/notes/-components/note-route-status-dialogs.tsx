import { RouteStatusDialog } from "@/components/screens/route-status-dialog";
import { Button } from "@/components/ui/button";
import { useRouteRetry } from "@/hooks/use-route-retry";

import type { NoteDialogNavigation } from "../-hooks/use-note-dialog-navigation";

export function NoteNotFoundDialog(props: NoteDialogNavigation) {
  return (
    <RouteStatusDialog
      {...props}
      title="メモが見つかりません"
      description="削除されたか、URL が誤っています。"
    />
  );
}

/**
 * route の読み込み (loader の取得、component の chunk) の失敗。例外の文言は出さない。errorComponent で文言を
 * 描くのは `RouteErrorContent` に限り (`docs/guides/server-errors.md`「詳細を出す環境を変える」)、
 * `RouteErrorContent` は自分の h1 を持つのでダイアログの中に置けない
 */
export function NoteRouteErrorDialog(props: NoteDialogNavigation & { title: string }) {
  const handleRetry = useRouteRetry();
  return (
    <RouteStatusDialog
      {...props}
      description="時間をおいて再試行してください。"
      action={<Button onClick={handleRetry}>再試行</Button>}
    />
  );
}
