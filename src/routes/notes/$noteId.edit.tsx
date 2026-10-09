import { createFileRoute } from "@tanstack/react-router";

import { noteQueryOptions } from "@/features/notes/queries";
import { pageTitle } from "@/lib/page-title";

import { NoteEditDialog } from "./-components/note-edit-dialog";
import {
  NoteEditErrorDialog,
  NoteEditNotFoundDialog,
  NoteEditPendingDialog,
} from "./-components/note-edit-status-dialogs";
import { NOTE_EDIT_DIALOG_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes/$noteId/edit")({
  // URL の noteId は数値の id。数値でない値は getNote の検証 (noteIdSchema) が弾き、errorComponent が受ける
  params: {
    parse: ({ noteId }) => ({ noteId: Number(noteId) }),
    stringify: ({ noteId }) => ({ noteId: String(noteId) }),
  },
  // 一覧の上に重ねるダイアログの route。一覧との行き来を遷移として伝えない (ADR-0035)
  staticData: { dialogRoute: true },
  // params だけが変わる遷移でも component を作り直す。既定では使い回し、前のメモに打った入力が残ったまま
  // 保存先だけが移った先のメモになる (ADR-0041)
  loader: {
    // キャッシュがあっても取り直し、取り終えるまで開かない。既定の background では、戻るで入ったときに
    // 前に取った値で開き、新しい値が届くと触れていないフォームは利用者の目の前で値が替わり、打ち始めた
    // フォームは古い値のまま残る (ADR-0041)
    handler: ({ context, params }) =>
      context.queryClient.query({ ...noteQueryOptions(params.noteId), staleTime: 0 }),
    staleReloadMode: "blocking",
  },
  remountDeps: ({ params }) => params,
  head: (ctx) => ({ meta: [{ title: pageTitle(ctx, NOTE_EDIT_DIALOG_TITLE) }] }),
  pendingComponent: EditPending,
  notFoundComponent: EditNotFound,
  errorComponent: EditError,
  component: EditRoute,
});

/** 閉じたら一覧へ戻る。一覧の絞り込み (search) を保ち、新しい履歴を積むので、戻るで開き直せる */
function useCloseToNotes() {
  const navigate = Route.useNavigate();
  return () => {
    void navigate({ to: "/notes", search: (prev) => prev });
  };
}

/** Route hooks を吸収する薄い wrapper。ダイアログは値とハンドラを props で受ける (ADR-0010) */
function EditRoute() {
  const { noteId } = Route.useParams();
  const onClosed = useCloseToNotes();
  return <NoteEditDialog noteId={noteId} onClosed={onClosed} />;
}

function EditPending() {
  const { noteId } = Route.useParams();
  const onClosed = useCloseToNotes();
  return <NoteEditPendingDialog noteId={noteId} onClosed={onClosed} />;
}

function EditNotFound() {
  const { noteId } = Route.useParams();
  const onClosed = useCloseToNotes();
  return <NoteEditNotFoundDialog noteId={noteId} onClosed={onClosed} />;
}

function EditError() {
  const { noteId } = Route.useParams();
  const onClosed = useCloseToNotes();
  return <NoteEditErrorDialog noteId={noteId} onClosed={onClosed} />;
}
