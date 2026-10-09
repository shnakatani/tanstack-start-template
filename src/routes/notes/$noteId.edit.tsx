import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import * as v from "valibot";

import { noteQueryOptions } from "@/features/notes/queries";
import { noteIdSchema } from "@/features/notes/schema";
import { pageTitle } from "@/lib/page-title";

import { NoteEditDialog } from "./-components/note-edit-dialog";
import {
  NoteEditErrorDialog,
  NoteEditNotFoundDialog,
  NoteEditPendingDialog,
} from "./-components/note-edit-status-dialogs";
import { NOTE_EDIT_DIALOG_TITLE } from "./-lib/notes-page-constants";

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
    handler: ({ context, params }) => {
      // id の形でなければ取得しない。取得に回すと getNote の検証 (noteIdSchema) が弾き、再試行しても
      // 直らない取得の失敗として出る
      if (!v.is(noteIdSchema, { id: params.noteId })) {
        throw notFound();
      }
      return context.queryClient.query({ ...noteQueryOptions(params.noteId), staleTime: 0 });
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

/**
 * Route hooks を吸収し、ダイアログへ渡す値とハンドラを返す (ADR-0010)。閉じたら一覧へ戻る。一覧の絞り込み
 * (search) を保ち、新しい履歴を積むので、戻るで開き直せる
 */
function useEditDialogProps() {
  const { noteId } = Route.useParams();
  const navigate = Route.useNavigate();
  const router = useRouter();
  function onClosed() {
    void navigate({ to: "/notes", search: (prev) => prev });
  }
  // ダイアログが unmount する時点で、この route がまだ表示されているか。`router.state` は描画の値ではなく
  // 読んだ時点の状態を返す (Router docs「useRouter hook」)。hook で読んだ値は最後の描画のもので、
  // unmount の時点の遷移先を映さない
  function isEditRouteActive() {
    return router.state.matches.some((match) => match.routeId === Route.id);
  }
  return { noteId, onClosed, isEditRouteActive };
}

/** Route hooks を吸収する薄い wrapper。ダイアログは値とハンドラを props で受ける (ADR-0010) */
function EditRoute() {
  return <NoteEditDialog {...useEditDialogProps()} />;
}

function EditPending() {
  return <NoteEditPendingDialog {...useEditDialogProps()} />;
}

function EditNotFound() {
  return <NoteEditNotFoundDialog {...useEditDialogProps()} />;
}

function EditError() {
  return <NoteEditErrorDialog {...useEditDialogProps()} />;
}
