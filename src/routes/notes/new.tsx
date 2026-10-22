import { createFileRoute } from "@tanstack/react-router";

import { RoutePendingDialog } from "@/components/screens/route-status-dialog";
import { dialogRouteOptions } from "@/lib/page-title";

import { NoteCreateDialog } from "./-components/note-create-dialog";
import { NoteRouteErrorDialog } from "./-components/note-route-status-dialogs";
import { findNoteCreateLink } from "./-lib/note-dialog-focus";
import { NOTE_CREATE_DIALOG_TITLE, NOTE_DIALOG_RETURN_TO } from "./-lib/notes-page-constants";

// pageName はダイアログの名前で、title のページ名になる。routeDialog はダイアログの route の印で、閉じる遷移で
// ダイアログの退場を見せ、背後のページの見出しの行に名前を出さない (ADR-0035、ADR-0041)
const pageOptions = dialogRouteOptions(NOTE_CREATE_DIALOG_TITLE);

export const Route = createFileRoute("/notes/new")({
  ...pageOptions,
  // loader は無く、待つのは component の chunk だけ。無いと、chunk の読み込み中と失敗が router の既定の
  // 表示になり、一覧の下 (`<Outlet />` の位置) に出る
  pendingComponent: CreatePending,
  errorComponent: CreateError,
  component: CreateRoute,
});

function CreateRoute() {
  return <NoteCreateDialog />;
}

function CreatePending() {
  return (
    <RoutePendingDialog
      title={NOTE_CREATE_DIALOG_TITLE}
      returnTo={NOTE_DIALOG_RETURN_TO}
      findReturnTarget={findNoteCreateLink}
    />
  );
}

function CreateError() {
  return (
    <NoteRouteErrorDialog
      title="フォームを読み込めませんでした"
      findReturnTarget={findNoteCreateLink}
    />
  );
}
