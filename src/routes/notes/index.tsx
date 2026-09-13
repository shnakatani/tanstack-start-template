import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

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
import { removeNote } from "@/features/notes/functions";
import { notesQueryOptions } from "@/features/notes/queries";
import { NOTE_FIELD_LABELS, noteIdSchema } from "@/features/notes/schema";
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
const noteDeleteDialogHandle = createAlertDialogHandle<DeleteTarget>();

function NotesPage() {
  const notesQuery = useSuspenseQuery(notesQueryOptions);
  const queryClient = useQueryClient();

  const deleteMutation = useActionMutation({
    // DeleteTarget は id を string で持つ (汎用部品の契約)。行の payload で String(note.id) にした
    // ものをここで戻す。Number() は失敗を NaN で返して黙って通るため、noteIdSchema で
    // parse し直して不正値を fail-closed で止める (throw は onError の toast へ流れる)
    mutationFn: (id: string) => removeNote({ data: v.parse(noteIdSchema, { id: Number(id) }) }),
    onSuccess: async () => {
      // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと削除後の一覧が古いままになる。
      // 再取得を await してから閉じる。先に閉じると pending 表示ごと消え、古い一覧が
      // pending なしで見える (ADR-0014)
      await queryClient.invalidateQueries({ queryKey: notesQueryOptions.queryKey });
      noteDeleteDialogHandle.close();
    },
    // server の raw message は開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

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
                // 楽観表示は query 側 (mutation.variables) で行う。useOptimistic は query の data を
                // base にできない (ADR-0014「楽観表示の使い分け」)。isPending はこの表示のゲートで、
                // pending 表示 (確認ボタンの Transition) とは別物
                const isDeleting =
                  deleteMutation.isPending && deleteMutation.variables === String(note.id);
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
                        payload={{ id: String(note.id), name: note.title }}
                        render={
                          <Button
                            variant="destructive"
                            size="sm"
                            focusableWhenDisabled
                            // focusableWhenDisabled は native disabled を付けないため registry の disabled: variant が
                            // 当たらない。Base UI が付ける data-disabled で同じ見た目にする (Base UI Button docs の
                            // Loading states と同じ形)
                            className="data-disabled:pointer-events-none data-disabled:opacity-50"
                          />
                        }
                        // 行が増えても操作対象が読み上げで分かるようにする。可視ラベル「削除」を
                        // 含めることで WCAG 2.5.3 (Label in Name) も満たす
                        aria-label={`${note.title}を削除`}
                        // 確認ダイアログは pending 中も Cancel / Escape で閉じられる (Base UI が
                        // 無効化するのは outsidePress だけ)。閉じた後に別行のトリガーが生きていると、
                        // 先行削除の onSuccess が同じ handle を close() して後続のダイアログを未確定の
                        // まま閉じる。render 側の focusableWhenDisabled は Cancel 後に Base UI が
                        // トリガーへフォーカスを返すとき、native disabled でフォーカスが body へ
                        // 落ちるのを防ぐ (Trigger の props 型は受けず Button primitive が受ける)。
                        // この isPending は楽観表示と同じゲートで、pending 表示の二重化ではない
                        disabled={deleteMutation.isPending}
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
        onConfirm={(target) => deleteMutation.runAction(target.id)}
      />
    </div>
  );
}
