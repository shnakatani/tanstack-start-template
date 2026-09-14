import type { QueryClient } from "@tanstack/react-query";
import { useMutationState, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DataTable } from "@/components/data-table";
import type { DeleteTarget } from "@/components/delete-confirm-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { parseCreatingRows } from "@/features/notes/creating-rows";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import { noteMutationFilters, removeNoteMutation } from "@/features/notes/mutations";
import { getNoteRowId, toNoteRows } from "@/features/notes/note-rows";
import { notesQueryOptions } from "@/features/notes/queries";
import type { Note } from "@/features/notes/schema";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { NoteCreateDialog, noteCreateDialogHandle } from "./-components/note-create-dialog";
import { noteColumns } from "./-lib/note-columns";
import { noteDeleteDialogHandle } from "./-lib/note-delete-dialog-handle";

const PAGE_TITLE = "メモ一覧";

/**
 * 一覧 loader 本体 (named function に切り出し、loader テストから直接呼べるようにする)。
 * context は LoaderFnContext の構造的部分型として受け、テストでは最小オブジェクトを渡す。
 */
export function loadNotesPageData({ context }: { context: { queryClient: QueryClient } }) {
  // staleTime: "static" はこの呼び出しだけに効き、キャッシュがあれば必ずそれを返す
  // (無ければ取得する)。queryOptions 側の staleTime を書き換えると observer の再取得まで
  // 止まるため、上書きは呼び出し側に置く
  return context.queryClient.query({ ...notesQueryOptions, staleTime: "static" });
}

export const Route = createFileRoute("/notes/")({
  loader: loadNotesPageData,
  pendingComponent: NotesPagePending,
  component: NotesPage,
});

function NotesPagePending() {
  return (
    <div>
      <PageHeader title={PAGE_TITLE} />
      <div className="p-4">
        <TableSkeleton columns={noteColumns.length} />
      </div>
    </div>
  );
}

/**
 * pending な行 (保存中・削除中) の見え方。半透明で pending を伝える (ADR-0016) が、
 * `opacity-50` は本文を 3.82:1 まで落として WCAG 1.4.3 の 4.5:1 を割る
 * (`index.test.tsx` の楽観行の a11y 検査が axe で実測)。比率を満たす範囲で薄くする。
 * `rowProps` が保存中・削除中の両方に当てる。cva variant にすると registry の `TableRow` に
 * variant を持たせることになる (ADR-0006 の対象) ので、消費側の定数で持つ。
 */
const busyRowAppearance = "opacity-60";

function NotesPage() {
  const notesQuery = useSuspenseQuery(notesQueryOptions);
  const queryClient = useQueryClient();

  const deleteMutation = useActionMutation({
    ...removeNoteMutation,
    // 開始の通知の置き場 (ADR-0017)。この画面は variables 方式 (ADR-0016) なのでキャッシュは触らない。
    // 行の半透明と aria-busy は読み上げに出ないので、開始を通知する
    onMutate: (target) => {
      announce(`『${target.name}』を削除しています`);
    },
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと削除後の一覧が古いままになる。
    // 再取得を await して pending を再取得完了まで保つ (ADR-0016)。閉じるのは確定時 (完了点 (a))
    onSuccess: async (_data, target) => {
      await queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey });
      // 行の消失は読み上げに出ないので、完了を通知する (ADR-0017)
      announce(`『${target.name}』を削除しました`);
    },
    // server の raw message は開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // pending な削除の対象 id。mutation ごとに追うので、同時削除でも各行が busy になる (ADR-0016)。
  // `mutation.state.variables` は `unknown` なので、行と突き合わせる前に削除対象へ絞って
  // id を取り出す (形が違う値は parseDeletingIds が warn を残して除外する)
  const pendingDeleteVariables = useMutationState({
    filters: { ...noteMutationFilters.remove, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  // 完了点 (b) の追加は応答でダイアログが閉じるので、再取得完了までの pending は
  // 一覧の先頭に出すこの行だけが伝える (ADR-0016)。mutation はダイアログ側にあるため
  // mutationKey 経由で読む。submittedAt は同時に走る追加を React の key で区別するのに使う
  const pendingCreateStates = useMutationState({
    filters: { ...noteMutationFilters.create, status: "pending" },
    select: (mutation) => ({
      variables: mutation.state.variables,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  // 派生値は hook より後ろで作る (ADR-0019「data の組み立て」。oxc-transform-react の出力で実測)
  const deletingIds = parseDeletingIds(pendingDeleteVariables);
  const creatingRows = parseCreatingRows(pendingCreateStates);
  const rows = toNoteRows({ notes: notesQuery.data, creatingRows, deletingIds });

  // 完了点 (a): Action は close だけを含み、mutation は Transition の外で走らせる (ADR-0016)。
  // close の animate-out の間は isPending の dedupe が効かないので、同じ対象が pending なら no-op
  function confirmDelete(target: DeleteTarget<Note["id"]>) {
    const alreadyDeleting =
      queryClient.isMutating({
        ...noteMutationFilters.remove,
        // variables は `unknown` なので、比較する前に描画側と同じ経路で id へ絞る
        predicate: (mutation) => parseDeletingIds([mutation.state.variables]).includes(target.id),
      }) > 0;
    if (alreadyDeleting) {
      return;
    }
    noteDeleteDialogHandle.close();
    // reject は runAction が吸収し onError が toast に出す。ここでは待たない
    void deleteMutation.runAction(target);
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={PAGE_TITLE}
        actions={
          <DialogTrigger handle={noteCreateDialogHandle} render={<Button />}>
            ＋ {NOTE_ENTITY_LABEL}を追加
          </DialogTrigger>
        }
      />

      <div className="flex flex-1 flex-col p-4">
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{NOTE_ENTITY_LABEL}が登録されていません</EmptyTitle>
              <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DataTable
            tableKey="notes"
            columns={noteColumns}
            data={rows}
            getRowId={getNoteRowId}
            // busy の判定は行データから (ADR-0016)。通知は announcer が担う (ADR-0017)
            rowProps={({ original }) => {
              const isBusy = original.kind === "creating" || original.isDeleting;
              return { "aria-busy": isBusy, className: isBusy ? busyRowAppearance : undefined };
            }}
          />
        )}
      </div>

      <NoteCreateDialog />

      {/* Root は 1 handle につき 1 つ。trigger は列定義側にあり、同じ handle で結ぶ */}
      <DeleteConfirmDialog
        handle={noteDeleteDialogHandle}
        entityLabel={NOTE_ENTITY_LABEL}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
