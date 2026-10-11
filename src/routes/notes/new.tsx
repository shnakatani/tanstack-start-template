import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "@/lib/page-title";

import { NoteCreateDialog } from "./-components/note-create-dialog";
import { useNoteDialogRoute } from "./-hooks/use-note-dialog-route";
import { NOTE_CREATE_DIALOG_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes/new")({
  head: (ctx) => ({ meta: [{ title: pageTitle(ctx, NOTE_CREATE_DIALOG_TITLE) }] }),
  component: CreateRoute,
});

/** Route hooks を吸収する薄い wrapper。ダイアログは値とハンドラを props で受ける (ADR-0010) */
function CreateRoute() {
  return <NoteCreateDialog {...useNoteDialogRoute()} />;
}
