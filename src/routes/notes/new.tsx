import { createFileRoute, useRouter } from "@tanstack/react-router";

import { pageTitle } from "@/lib/page-title";

import { NoteCreateDialog } from "./-components/note-create-dialog";
import { isNoteDialogRouteShown } from "./-lib/note-dialog-focus";
import { NOTE_CREATE_DIALOG_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes/new")({
  head: (ctx) => ({ meta: [{ title: pageTitle(ctx, NOTE_CREATE_DIALOG_TITLE) }] }),
  component: CreateRoute,
});

/**
 * Route hooks を吸収する薄い wrapper。ダイアログは値とハンドラを props で受ける (ADR-0010)。閉じたら一覧へ
 * 戻る。一覧の絞り込み (search) を保ち、新しい履歴を積むので、戻るで開き直せる
 */
function CreateRoute() {
  const navigate = Route.useNavigate();
  const router = useRouter();
  function onClosed() {
    void navigate({ to: "/notes", search: (prev) => prev });
  }
  // `router.state` は描画の値ではなく読んだ時点の状態を返す (Router docs「useRouter hook」)。hook で読んだ値は
  // 最後の描画のもので、unmount の時点の遷移先を映さない
  function isDialogRouteShown() {
    return isNoteDialogRouteShown(router.state.matches);
  }
  return <NoteCreateDialog onClosed={onClosed} isDialogRouteShown={isDialogRouteShown} />;
}
