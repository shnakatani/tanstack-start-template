import type { QueryClient } from "@tanstack/react-query";
import { useMutationState, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { actionDisabledAppearance } from "@/components/action/button";
import type { DeleteTarget } from "@/components/delete-confirm-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AlertDialogTrigger, createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import { removeNote } from "@/features/notes/functions";
import { noteMutationKeys } from "@/features/notes/mutations";
import { notesQueryOptions } from "@/features/notes/queries";
import type { Note } from "@/features/notes/schema";
import { NOTE_FIELD_LABELS } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatDateTime } from "@/lib/format-date-time";
import { toastMutationError } from "@/lib/mutation-error";

import { NoteCreateDialog, noteCreateDialogHandle } from "./-components/note-create-dialog";

const PAGE_TITLE = "メモ一覧";
const ENTITY_LABEL = "メモ";

/**
 * 列見出しの SSOT。`TableSkeleton` の列数もここから採るので、列を足しても
 * pending 表示との食い違い (ロード完了時のレイアウトシフト) が起きない。
 */
const NOTE_TABLE_HEADERS = [
  NOTE_FIELD_LABELS.title,
  NOTE_FIELD_LABELS.body,
  "作成日時",
  "操作",
] as const;

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
        <TableSkeleton columns={NOTE_TABLE_HEADERS.length} />
      </div>
    </div>
  );
}

/** 削除確認ダイアログの detached trigger を Root へ結ぶ handle。Root は 1 つだけ描画する。 */
const noteDeleteDialogHandle = createAlertDialogHandle<DeleteTarget<Note["id"]>>();

function NotesPage() {
  const notesQuery = useSuspenseQuery(notesQueryOptions);
  const queryClient = useQueryClient();

  const deleteMutation = useActionMutation({
    mutationKey: noteMutationKeys.remove,
    // id の検証は removeNote 側の validator (noteIdSchema) が持つ
    mutationFn: (id: Note["id"]) => removeNote({ data: { id } }),
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと削除後の一覧が古いままになる。
    // 再取得の Promise を返し、再取得完了まで pending を保つ (ADR-0016)。閉じるのは確定時 (完了点 (a))
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey }),
    // server の raw message は開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // pending な削除の対象 id。mutation ごとに追うので、同時削除でも各行が busy になる (ADR-0016)。
  // `mutation.state.variables` は `unknown` なので、行と突き合わせる前に id へ絞る
  // (id でない値は parseDeletingIds が warn を残して除外する)
  const pendingDeleteVariables = useMutationState({
    filters: { mutationKey: noteMutationKeys.remove, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });
  const deletingIds = parseDeletingIds(pendingDeleteVariables);

  // 完了点 (a): Action は close だけを含み、mutation は Transition の外で走らせる (ADR-0016)。
  // close の animate-out の間は isPending の dedupe が効かないので、同じ対象が pending なら no-op
  function confirmDelete(target: DeleteTarget<Note["id"]>) {
    const alreadyDeleting =
      queryClient.isMutating({
        mutationKey: noteMutationKeys.remove,
        predicate: (mutation) => mutation.state.variables === target.id,
      }) > 0;
    if (alreadyDeleting) {
      return;
    }
    noteDeleteDialogHandle.close();
    // reject は runAction が吸収し onError が toast に出す。ここでは待たない
    void deleteMutation.runAction(target.id);
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={PAGE_TITLE}
        actions={
          <DialogTrigger handle={noteCreateDialogHandle} render={<Button />}>
            ＋ {ENTITY_LABEL}を追加
          </DialogTrigger>
        }
      />

      <div className="flex flex-1 flex-col p-4">
        {notesQuery.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{ENTITY_LABEL}が登録されていません</EmptyTitle>
              <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {NOTE_TABLE_HEADERS.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notesQuery.data.map((note) => {
                // 楽観表示は query 側 (pending な mutation の variables) で行う。useOptimistic は
                // query の data を base にできない (ADR-0014「楽観表示の使い分け」)。確定で
                // ダイアログを閉じるので、再取得完了までの pending はこの行の表現だけが伝える
                const isDeleting = deletingIds.includes(note.id);
                return (
                  <TableRow
                    key={note.id}
                    aria-busy={isDeleting}
                    className={isDeleting ? "opacity-50" : undefined}
                  >
                    <TableCell>{note.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{note.body}</TableCell>
                    {/* 整形は必ずタイムゾーンを明示した formatDateTime を通す。ローカル TZ 依存の
                        整形は SSR と hydration で文字列が食い違う (format-date-time.ts) */}
                    <TableCell>{formatDateTime(note.createdAt)}</TableCell>
                    <TableCell>
                      <AlertDialogTrigger
                        handle={noteDeleteDialogHandle}
                        payload={{ id: note.id, name: note.title }}
                        render={
                          <Button
                            variant="destructive"
                            size="sm"
                            focusableWhenDisabled
                            className={actionDisabledAppearance}
                          />
                        }
                        // 行が増えても操作対象が読み上げで分かるようにする。可視ラベル「削除」を
                        // 含めることで WCAG 2.5.3 (Label in Name) も満たす
                        aria-label={`${note.title}を削除`}
                        // 止めるのは削除中の行だけ (ADR-0016「ブロック範囲」)。render 側の
                        // focusableWhenDisabled は閉じたあと Base UI がトリガーへフォーカスを返すとき、
                        // native disabled でフォーカスが body へ落ちるのを防ぐ
                        // (Trigger の props 型は受けず Button primitive が受ける)
                        disabled={isDeleting}
                      >
                        削除
                      </AlertDialogTrigger>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <NoteCreateDialog />

      <DeleteConfirmDialog
        handle={noteDeleteDialogHandle}
        entityLabel={ENTITY_LABEL}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
