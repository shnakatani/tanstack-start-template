import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "@/lib/page-title";

import { NoteCreateDialog } from "./-components/note-create-dialog";
import {
  NoteRouteErrorDialog,
  NoteRoutePendingDialog,
} from "./-components/note-route-status-dialogs";
import { useNoteDialogNavigation } from "./-hooks/use-note-dialog-navigation";
import { findNoteCreateLink } from "./-lib/note-dialog-focus";
import { NOTE_CREATE_DIALOG_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes/new")({
  head: (ctx) => ({ meta: [{ title: pageTitle(ctx, NOTE_CREATE_DIALOG_TITLE) }] }),
  // loader は無く、待つのは component の chunk だけ。無いと、chunk の読み込み中と失敗が router の既定の
  // 表示になり、一覧の下 (`<Outlet />` の位置) に出る
  pendingComponent: CreatePending,
  errorComponent: CreateError,
  component: CreateRoute,
});

/** Route hooks を吸収する薄い wrapper。ダイアログは値とハンドラを props で受ける (ADR-0010) */
function CreateRoute() {
  return <NoteCreateDialog {...useNoteDialogNavigation()} />;
}

function CreatePending() {
  return (
    <NoteRoutePendingDialog
      title={NOTE_CREATE_DIALOG_TITLE}
      findReturnTarget={findNoteCreateLink}
      {...useNoteDialogNavigation()}
    />
  );
}

function CreateError() {
  return (
    <NoteRouteErrorDialog
      title="フォームを読み込めませんでした"
      findReturnTarget={findNoteCreateLink}
      {...useNoteDialogNavigation()}
    />
  );
}
