import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutationState, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import * as v from "valibot";

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
import { NOTE_ENTITY_LABEL, noteListFilterSchema } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { noteColumns } from "../-lib/note-columns";
import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { getNoteRowId, isNoteRowBusy, toNoteRows } from "../-lib/note-rows";
import { NOTE_SEARCH_DEBOUNCE_MS, noteSearchResultMessage } from "../-lib/note-search";
import { NOTES_PAGE_TITLE } from "../-lib/notes-page-title";
import { NoteCreateDialog, noteCreateDialogHandle } from "./note-create-dialog";
import { NoteSearchField } from "./note-search-field";

/** URL / server function と同じ schema で正規化する (trim / 上限)。 */
function normalizeQuery(text: string): string {
  return v.parse(noteListFilterSchema, { q: text }).q;
}

/**
 * 一覧ページ本体。`q` は URL で確定した検索語、`onQueryChange` は確定の要求 (submit)。
 * route ファイルから export せずここに置く (ADR-0013)。入力欄と一覧の流れは ADR-0024。
 */
export function NotesPage({ q, onQueryChange }: { q: string; onQueryChange: (q: string) => void }) {
  // URL の q が変わった世代。値ではなく世代で編集を紐付ける: 履歴は同じ値へ戻れるので、値で照合すると
  // 確定した後に戻ったとき古い編集が復活する。prop の変化は描画中に導く (React docs「Adjusting some
  // state when a prop changes」。ADR-0024)
  const [urlGeneration, setUrlGeneration] = useState({ q, generation: 0 });
  if (urlGeneration.q !== q) {
    setUrlGeneration({ q, generation: urlGeneration.generation + 1 });
  }
  const { generation } = urlGeneration;
  // 入力欄の state はその世代の URL に対する編集。世代が進めば表示も debounce 済みの値も q に戻る
  const [edit, setEdit] = useState<{ generation: number; text: string } | null>(null);
  const text = edit !== null && edit.generation === generation ? edit.text : q;
  function handleTextChange(next: string) {
    setEdit({ generation, text: next });
  }
  const draftQ = normalizeQuery(text);
  const [debouncedEdit] = useDebouncedValue(edit, { wait: NOTE_SEARCH_DEBOUNCE_MS });
  const settledQ =
    debouncedEdit !== null && debouncedEdit.generation === generation
      ? normalizeQuery(debouncedEdit.text)
      : q;
  const deferredQ = useDeferredValue(settledQ);
  const notesQuery = useSuspenseQuery(notesQueryOptions({ q: deferredQ }));
  const queryClient = useQueryClient();
  const isStale = draftQ !== deferredQ;

  // 結果の入れ替わりの通知。announcer (ADR-0037) を、取得の決着を契機にここから呼ぶ。取得中は古い件数を読むので決着まで待ち、直前と同じ条件なら出さない。
  // ref の初期値が URL の q なので初期表示は通知されない
  const settled = !notesQuery.isFetching;
  const announcedQ = useRef(q);
  const announceResults = useEffectEvent(() => {
    announce(noteSearchResultMessage(deferredQ, notesQuery.data.length));
  });
  useEffect(() => {
    if (!settled || announcedQ.current === deferredQ) {
      return;
    }
    announcedQ.current = deferredQ;
    announceResults();
  }, [deferredQ, settled]);

  const deleteMutation = useActionMutation({
    ...removeNoteMutation,
    // 開始の通知の置き場 (ADR-0037)。この画面は variables 方式 (ADR-0021) なのでキャッシュは触らない。
    // 行の半透明と aria-busy は読み上げに出ないので、開始を通知する
    onMutate: (target) => {
      announce(`『${target.name}』を削除しています`);
    },
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと削除後の一覧が古いままになる。
    // 再取得を await して pending を再取得完了まで保つ (ADR-0021)。閉じるのは確定時 (完了点 (a))
    onSuccess: async (_data, target) => {
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 行の消失は読み上げに出ないので、完了を通知する (ADR-0037)
      announce(`『${target.name}』を削除しました`);
    },
    // server の raw message は開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  // pending な削除の対象 id。mutation ごとに追うので、同時削除でも各行が busy になる (ADR-0021)。
  // `mutation.state.variables` は `unknown` なので、行と突き合わせる前に削除対象へ絞って
  // id を取り出す (形が違う値は parseDeletingIds が warn を残して除外する)
  const pendingDeleteVariables = useMutationState({
    filters: { ...noteMutationFilters.remove, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  // 完了点 (b) の追加は応答でダイアログが閉じるので、再取得完了までの pending は
  // 一覧の先頭に出すこの行だけが伝える (ADR-0021)。mutation はダイアログ側にあるため
  // mutationKey 経由で読む。submittedAt は同時に走る追加を React の key で区別するのに使う
  const pendingCreateStates = useMutationState({
    filters: { ...noteMutationFilters.create, status: "pending" },
    select: (mutation) => ({
      variables: mutation.state.variables,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  // 派生値は hook より後ろで作る (ADR-0022「data の組み立て」。oxc-transform-react の出力で実測)
  const deletingIds = parseDeletingIds(pendingDeleteVariables);
  const creatingRows = parseCreatingRows(pendingCreateStates);
  const rows = toNoteRows({ notes: notesQuery.data, creatingRows, deletingIds });

  function handleSubmit() {
    // 正規化で値が変わるときだけ入力欄を揃える (trim と切り詰めが見える)
    if (text !== draftQ) {
      setEdit({ generation, text: draftQ });
    }
    onQueryChange(draftQ);
  }

  // 完了点 (a): Action は close だけを含み、mutation は Transition の外で走らせる (ADR-0021)。
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
                {deferredQ === "" ? (
                  <>
                    <EmptyTitle>{NOTE_ENTITY_LABEL}が登録されていません</EmptyTitle>
                    <EmptyDescription>右上の追加ボタンから登録できます</EmptyDescription>
                  </>
                ) : (
                  <>
                    <EmptyTitle>
                      『{deferredQ}』に一致する{NOTE_ENTITY_LABEL}はありません
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
              // busy の判定は行データから (ADR-0021)。通知は announcer が担う (ADR-0037)
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
