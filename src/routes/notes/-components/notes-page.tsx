import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutationState, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";

import { DataTable } from "@/components/parts/data-table";
import { DeleteConfirmDialog } from "@/components/parts/delete-confirm-dialog";
import { PageHeader } from "@/components/parts/page-header";
import { StaleContent } from "@/components/parts/stale-content";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { parseCreatingRows } from "@/features/notes/creating-rows";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import type { NoteDeleteTarget } from "@/features/notes/mutations";
import { noteMutationFilters, removeNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY, notesQueryOptions } from "@/features/notes/queries";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { noteColumns } from "../-lib/note-columns";
import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { getNoteRowId, isNoteRowBusy, toNoteRows } from "../-lib/note-rows";
import {
  NOTE_SEARCH_DEBOUNCE_MS,
  noteSearchResultMessage,
  toNoteListFilter,
} from "../-lib/note-search";
import { NOTES_PAGE_TITLE } from "../-lib/notes-page-title";
import { NoteCreateDialog, noteCreateDialogHandle } from "./note-create-dialog";
import { NoteSearchField } from "./note-search-field";

/**
 * 一覧ページ本体。`q` は URL で確定した検索語、`onQueryChange` は確定の要求 (submit)。
 * route ファイルから export せずここに置く (ADR-0012)。入力欄と一覧の流れは ADR-0033、
 * 件数の通知は ADR-0034。
 */
export function NotesPage({ q, onQueryChange }: { q: string; onQueryChange: (q: string) => void }) {
  const [edit, setEdit] = useState<{ base: string; text: string } | null>(null);
  const text = edit !== null && edit.base === q ? edit.text : q;
  function handleTextChange(next: string) {
    setEdit({ base: q, text: next });
  }
  const [debouncedText] = useDebouncedValue(text, { wait: NOTE_SEARCH_DEBOUNCE_MS });
  // 入力欄が URL と同じなら debounce を待たない (確定と戻るの直後に、温め済みの条件を遅らせない)
  const settledText = text === q ? q : debouncedText;
  const deferredText = useDeferredValue(settledText);
  // key にする前に URL / server function と同じ正規化を通す (理由は toNoteListFilter の docstring)
  const filter = toNoteListFilter(deferredText);
  // 正規化後で比べる。生の文字列だと、submit で入力欄を揃えた直後に条件が同じまま印が出る
  const isStale = toNoteListFilter(text).q !== filter.q;
  const notesQuery = useSuspenseQuery(notesQueryOptions(filter));
  const queryClient = useQueryClient();

  // 結果の入れ替わりの通知 (ADR-0034)。取得中は古い件数を読むので決着まで待ち、直前と同じ条件なら出さない。
  // ref の初期値が URL の q なので初期表示は通知されない
  const settled = !notesQuery.isFetching;
  const announcedQ = useRef(q);
  const announceResults = useEffectEvent((settledQ: string) => {
    announce(noteSearchResultMessage(settledQ, notesQuery.data.length));
  });
  useEffect(() => {
    if (!settled || announcedQ.current === filter.q) {
      return;
    }
    announcedQ.current = filter.q;
    announceResults(filter.q);
  }, [filter.q, settled]);

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
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
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

  function handleSubmit() {
    const next = toNoteListFilter(text).q;
    // 入力欄を正規化後の値に揃える (trim と切り詰めが見える)。URL が変われば base が合わなくなり、
    // 表示は新しい q から導かれる
    setEdit({ base: q, text: next });
    onQueryChange(next);
  }

  // 完了点 (a): Action は close だけを含み、mutation は Transition の外で走らせる (ADR-0016)。
  // close の animate-out の間は isPending の dedupe が効かないので、同じ対象が pending なら no-op
  function confirmDelete(target: NoteDeleteTarget) {
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
        title={NOTES_PAGE_TITLE}
        actions={
          <>
            <NoteSearchField
              value={text}
              onValueChange={handleTextChange}
              onSubmit={handleSubmit}
            />
            <DialogTrigger handle={noteCreateDialogHandle} render={<Button />}>
              ＋ {NOTE_ENTITY_LABEL}を追加
            </DialogTrigger>
          </>
        }
      />

      <div className="flex flex-1 flex-col p-4">
        <StaleContent stale={isStale}>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                {filter.q === "" ? (
                  <>
                    <EmptyTitle>{NOTE_ENTITY_LABEL}が登録されていません</EmptyTitle>
                    <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
                  </>
                ) : (
                  <>
                    <EmptyTitle>
                      『{filter.q}』に一致する{NOTE_ENTITY_LABEL}はありません
                    </EmptyTitle>
                    <EmptyDescription>
                      検索語を変えるか、空にして全件を表示できます
                    </EmptyDescription>
                  </>
                )}
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
                const isBusy = isNoteRowBusy(original);
                return { "aria-busy": isBusy };
              }}
            />
          )}
        </StaleContent>
      </div>

      <NoteCreateDialog />

      <DeleteConfirmDialog
        handle={noteDeleteDialogHandle}
        entityLabel={NOTE_ENTITY_LABEL}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
