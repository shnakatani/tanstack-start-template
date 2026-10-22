import { useMutationState, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useEffectEvent } from "react";

import { DataTable } from "@/components/parts/data-table";
import { StaleContent } from "@/components/parts/stale-content";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { parseCreatingRows } from "@/features/notes/creating-rows";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import { noteMutationFilters } from "@/features/notes/mutations";
import { notesQueryOptions } from "@/features/notes/queries";
import { NOTE_ENTITY_LABEL } from "@/features/notes/schema";
import { parseUpdatingNotes } from "@/features/notes/updating-rows";
import { announce } from "@/lib/live-announcer";

import { noteColumns } from "../-lib/note-columns";
import { canExpandNoteRow, getNoteRowId, isNoteRowBusy, toNoteRows } from "../-lib/note-rows";
import { noteSearchResultMessage } from "../-lib/note-search";
import { NOTES_PAGE_TITLE } from "../-lib/notes-page-constants";
import { NoteBodyDetail } from "./note-cells";

/**
 * 一覧の結果の部分 (表か空の状態)。`deferredQ` で一覧を読む。読み込みの失敗はページの `SectionErrorBoundary`
 * が受け、検索欄はページ側に残る (ADR-0033)。`claimAnnouncement` は、その検索語の件数をまだ通知していなければ通知済みにして true を返す。
 * 通知済みの語はページが持つ。失敗からの回復でこの部分が作り直されても引き継ぐためで、初期値が URL の `q` なので
 * 初期表示は通知されない
 */
export function NotesResults({
  claimAnnouncement,
  deferredQ,
  isStale,
}: {
  claimAnnouncement: (q: string) => boolean;
  deferredQ: string;
  isStale: boolean;
}) {
  const notesQuery = useSuspenseQuery(notesQueryOptions({ q: deferredQ }));

  // 結果の入れ替わりの通知 (ADR-0027)。取得中は古い件数を読むので決着まで待ち、直前と同じ条件なら出さない
  const settled = !notesQuery.isFetching;
  const announceResults = useEffectEvent(() => {
    if (claimAnnouncement(deferredQ)) {
      announce(noteSearchResultMessage(deferredQ, notesQuery.data.length));
    }
  });
  useEffect(() => {
    if (settled) {
      announceResults();
    }
  }, [deferredQ, settled]);

  // pending な削除の対象 id。mutation ごとに追うので、同時削除でも各行が busy になる (ADR-0017)。
  // `mutation.state.variables` は `unknown` なので、行と突き合わせる前に削除対象へ絞って
  // id を取り出す (形が違う値は parseDeletingIds が warn を残して除外する)
  const pendingDeleteVariables = useMutationState({
    filters: { ...noteMutationFilters.remove, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  // 完了点「サーバー応答」の追加は応答でダイアログが閉じるので、再取得完了までの pending は
  // 一覧の先頭に出すこの行だけが伝える (ADR-0017)。mutation は追加の route のダイアログ側にあるため
  // mutationKey 経由で読む。submittedAt は同時に走る追加を React の key で区別するのに使う
  const pendingCreateStates = useMutationState({
    filters: { ...noteMutationFilters.create, status: "pending" },
    select: (mutation) => ({
      variables: mutation.state.variables,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  // 更新も完了点「サーバー応答」で、応答でダイアログが閉じるので、再取得完了までの pending は行が伝える
  // (ADR-0017)。mutation は編集のダイアログ側にあるため mutationKey 経由で読む。variables に
  // 対象の id と編集後の値が載るので、対象の行だけを busy にして編集後の値で描ける
  const pendingUpdateVariables = useMutationState({
    filters: { ...noteMutationFilters.update, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  // 派生値は hook より後ろで作る (`docs/guides/lists-and-search.md`「一覧テーブルを組む」の data の組み立て行。oxc-transform-react の出力で実測)
  const deletingIds = parseDeletingIds(pendingDeleteVariables);
  const creatingRows = parseCreatingRows(pendingCreateStates);
  const updatingNotes = parseUpdatingNotes(pendingUpdateVariables);
  const rows = toNoteRows({ notes: notesQuery.data, creatingRows, deletingIds, updatingNotes });

  return (
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
                <EmptyDescription>検索語を変えるか、空にして全件を表示できます</EmptyDescription>
              </>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <DataTable
          tableKey="notes"
          caption={NOTES_PAGE_TITLE}
          columns={noteColumns}
          data={rows}
          getRowId={getNoteRowId}
          // busy の判定は行データから (ADR-0017)。通知は announcer が担う (ADR-0026)
          rowProps={({ original }) => {
            const isBusy = isNoteRowBusy(original);
            return { "data-busy": isBusy };
          }}
          getRowCanExpand={({ original }) => canExpandNoteRow(original)}
          renderSubComponent={NoteBodyDetail}
        />
      )}
    </StaleContent>
  );
}
