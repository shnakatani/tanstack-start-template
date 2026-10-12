import { createFileRoute, isNotFound, notFound } from "@tanstack/react-router";
import * as v from "valibot";

import { RoutePendingDialog } from "@/components/screens/route-status-dialog";
import { noteQueryOptions } from "@/features/notes/queries";
import { noteIdSchema } from "@/features/notes/schema";
import { pageTitle } from "@/lib/page-title";

import { NoteEditDialog } from "./-components/note-edit-dialog";
import { NoteNotFoundDialog, NoteRouteErrorDialog } from "./-components/note-route-status-dialogs";
import { findNoteEditLink } from "./-lib/note-dialog-focus";
import { invalidateNoteListsIfStale } from "./-lib/note-list-staleness";
import { NOTE_DIALOG_RETURN_TO, NOTE_EDIT_DIALOG_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes/$noteId/edit")({
  // URL の noteId は数値の id。id の形でない値は loader が見つからないものとして扱う
  params: {
    parse: ({ noteId }) => ({ noteId: Number(noteId) }),
    stringify: ({ noteId }) => ({ noteId: String(noteId) }),
  },
  loader: {
    // キャッシュがあっても取り直し、取り終えるまで開かない。既定の background では、戻るで入ったときに
    // 前に取った値で開き、新しい値が届くと触れていないフォームは利用者の目の前で値が替わり、打ち始めた
    // フォームは古い値のまま残る (ADR-0041)
    handler: async ({ context, params }) => {
      // id の形でなければ取得しない。取得に回すと getNote の検証 (noteIdSchema) が弾き、再試行しても
      // 直らない取得の失敗として出る
      if (!v.is(noteIdSchema, { id: params.noteId })) {
        throw notFound();
      }
      const { queryClient } = context;
      // 取り直した値か、見つからないこと (削除された) が背後の一覧の行と食い違えば、一覧を裏で取り直す
      const note = await queryClient
        .query({ ...noteQueryOptions(params.noteId), staleTime: 0 })
        .catch((error: unknown) => {
          if (isNotFound(error)) {
            invalidateNoteListsIfStale(queryClient, params.noteId, null);
          }
          throw error;
        });
      invalidateNoteListsIfStale(queryClient, note.id, note.updatedAt);
      return note;
    },
    staleReloadMode: "blocking",
  },
  // params だけが変わる遷移でも component を作り直す。既定では使い回し、前のメモに打った入力が残ったまま
  // 保存先だけが移った先のメモになる (ADR-0041)
  remountDeps: ({ params }) => params,
  head: (ctx) => ({ meta: [{ title: pageTitle(ctx, NOTE_EDIT_DIALOG_TITLE) }] }),
  pendingComponent: EditPending,
  notFoundComponent: EditNotFound,
  errorComponent: EditError,
  component: EditRoute,
});

/** Route hooks を吸収し、閉じたときに focus を戻す、開いたメモの行の編集リンクを探す関数を返す (ADR-0010) */
function useFindEditLink() {
  const { noteId } = Route.useParams();
  return () => findNoteEditLink(noteId);
}

function EditRoute() {
  const { noteId } = Route.useParams();
  return <NoteEditDialog noteId={noteId} />;
}

function EditPending() {
  const findReturnTarget = useFindEditLink();
  return (
    <RoutePendingDialog
      title={NOTE_EDIT_DIALOG_TITLE}
      returnTo={NOTE_DIALOG_RETURN_TO}
      findReturnTarget={findReturnTarget}
    />
  );
}

function EditNotFound() {
  const findReturnTarget = useFindEditLink();
  return <NoteNotFoundDialog findReturnTarget={findReturnTarget} />;
}

function EditError() {
  const findReturnTarget = useFindEditLink();
  return (
    <NoteRouteErrorDialog title="メモを読み込めませんでした" findReturnTarget={findReturnTarget} />
  );
}
