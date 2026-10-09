import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import * as v from "valibot";

import { NOTES_QUERY_KEY, noteQueryOptions } from "@/features/notes/queries";
import { noteIdSchema } from "@/features/notes/schema";
import type { Note } from "@/features/notes/schema";
import { pageTitle } from "@/lib/page-title";

import { NoteEditDialog } from "./-components/note-edit-dialog";
import {
  NoteEditErrorDialog,
  NoteEditNotFoundDialog,
  NoteEditPendingDialog,
} from "./-components/note-edit-status-dialogs";
import { hasDifferingListRow } from "./-lib/note-list-staleness";
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
    handler: async ({ context, params }) => {
      // id の形でなければ取得しない。取得に回すと getNote の検証 (noteIdSchema) が弾き、再試行しても
      // 直らない取得の失敗として出る
      if (!v.is(noteIdSchema, { id: params.noteId })) {
        throw notFound();
      }
      const { queryClient } = context;
      const note = await queryClient.query({ ...noteQueryOptions(params.noteId), staleTime: 0 });
      // 取り直した値が背後の一覧の行と食い違えば、一覧を invalidate して裏で取り直す。しないと、ダイアログは
      // 新しい値、背後の行は古い値のまま並ぶ。値を一覧のキャッシュへ書き込まない (ADR-0041)。
      // `NOTES_QUERY_KEY` の下には一覧の query だけを置くので、data は一覧の行の配列である
      const cachedLists = queryClient.getQueriesData<Note[]>({ queryKey: NOTES_QUERY_KEY });
      if (hasDifferingListRow(note, cachedLists)) {
        // ダイアログは一覧の取得を待たない。進行中の一覧の取得 (保存の後の再取得など) は取り消さない。
        // 既定の cancelRefetch: true は取り消して始め直し、取り消された取得を待つ側 (保存の onSuccess) が
        // 一覧の決着より先に終わる ("If set to `false`, no refetch will be made if there is already a
        // request running." Query reference「InvalidateOptions」)
        void queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }, { cancelRefetch: false });
      }
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
