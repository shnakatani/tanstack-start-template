import { RouteStatusDialog } from "@/components/screens/route-status-dialog";
import { Button } from "@/components/ui/button";
import { useRouteRetry } from "@/hooks/use-route-retry";

import { NOTE_DIALOG_RETURN_TO } from "../-lib/notes-page-constants";

/** findReturnTarget: 開いた元の要素 (行の編集リンク、追加のリンク) を探す。閉じたらそこへ focus を戻す */
interface NoteRouteStatusDialogProps {
  findReturnTarget: () => HTMLElement | null;
}

export function NoteNotFoundDialog({ findReturnTarget }: NoteRouteStatusDialogProps) {
  return (
    <RouteStatusDialog
      returnTo={NOTE_DIALOG_RETURN_TO}
      findReturnTarget={findReturnTarget}
      title="メモが見つかりません"
      description="削除されたか、URL が誤っています。"
    />
  );
}

/**
 * route の読み込み (loader の取得、component の chunk) の失敗。例外の文言は出さない。errorComponent で文言を
 * 描くのは `RouteErrorContent` に限り (`docs/guides/server-errors.md`「詳細を出す環境を変える」)、
 * `RouteErrorContent` はページ全体の枠 (`CenteredCard fill="section"`、`min-h-[50vh]` で中央寄せ) と
 * ページの見出し (`<h1>`、または印を付けた `<h2>`) を描くので、ダイアログの中に置けない
 */
export function NoteRouteErrorDialog({
  findReturnTarget,
  title,
}: NoteRouteStatusDialogProps & { title: string }) {
  const handleRetry = useRouteRetry();
  return (
    <RouteStatusDialog
      returnTo={NOTE_DIALOG_RETURN_TO}
      findReturnTarget={findReturnTarget}
      title={title}
      description="時間をおいて再試行してください。"
      action={<Button onClick={handleRetry}>再試行</Button>}
    />
  );
}
