import { useDebouncedValue } from "@tanstack/react-pacer";
import type { QueryClient } from "@tanstack/react-query";
import { useMutationState, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";

import { DataTable } from "@/components/parts/data-table";
import { DeleteConfirmDialog } from "@/components/parts/delete-confirm-dialog";
import { PageHeader } from "@/components/parts/page-header";
import { StaleContent } from "@/components/parts/stale-content";
import { TableSkeleton } from "@/components/parts/table-skeleton";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { parseCreatingRows } from "@/features/notes/creating-rows";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import type { NoteDeleteTarget } from "@/features/notes/mutations";
import { noteMutationFilters, removeNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY, notesQueryOptions } from "@/features/notes/queries";
import type { NoteListFilter } from "@/features/notes/schema";
import { NOTE_ENTITY_LABEL, noteListFilterSchema } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { NoteCreateDialog, noteCreateDialogHandle } from "./-components/note-create-dialog";
import { NoteSearchField } from "./-components/note-search-field";
import { noteColumns } from "./-lib/note-columns";
import { noteDeleteDialogHandle } from "./-lib/note-delete-dialog-handle";
import { getNoteRowId, isNoteRowBusy, toNoteRows } from "./-lib/note-rows";
import {
  NOTE_SEARCH_DEBOUNCE_MS,
  noteSearchResultMessage,
  toNoteListFilter,
} from "./-lib/note-search";

const PAGE_TITLE = "メモ一覧";

/**
 * 一覧 loader 本体 (named function に切り出し、loader テストから直接呼べるようにする)。
 * context は LoaderFnContext の構造的部分型として受け、テストでは最小オブジェクトを渡す。
 * `deps` は `loaderDeps` が search から取り出した絞り込み条件 (ADR-0033)。
 */
export function loadNotesPageData({
  context,
  deps,
}: {
  context: { queryClient: QueryClient };
  deps: NoteListFilter;
}) {
  // staleTime: "static" はこの呼び出しだけに効き、キャッシュがあれば必ずそれを返す
  // (無ければ取得する)。queryOptions 側の staleTime を書き換えると observer の再取得まで
  // 止まるため、上書きは呼び出し側に置く
  return context.queryClient.query({ ...notesQueryOptions(deps), staleTime: "static" });
}

export const Route = createFileRoute("/notes/")({
  // URL の search を schema で検証する。valibot 1.x は Standard Schema なので adapter 不要
  validateSearch: noteListFilterSchema,
  // 既定値 (q="") は URL に書かない。/notes と /notes?q= を同じ場所にする
  search: { middlewares: [stripSearchParams({ q: "" })] },
  // loader が読む search は deps として宣言する。deps が変わると loader が走り直し、条件ごとに
  // 別のキャッシュになる (Router docs「Using loaderDeps to access search params」)
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: loadNotesPageData,
  pendingComponent: NotesPagePending,
  component: NotesRoute,
});

/**
 * Route hooks を吸収する薄い wrapper。ページ本体は値とハンドラを props で受ける
 * (`.claude/rules/directory-structure.md`「ルートファイル」)。
 * `key={q}` で URL の q が変わるたびにページの入力欄の state を作り直す
 * (React docs「Resetting all state when a prop changes」。effect で setState しない)。
 */
function NotesRoute() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  function handleQueryChange(next: string) {
    // navigate は Router が startTransition で commit する (ADR-0014)。確定は利用者の明示操作
    // (submit) 1 回につき履歴 1 つで、戻るボタンが絞り込み前の一覧に戻る (ADR-0033)
    void navigate({ search: (prev) => ({ ...prev, q: next }) });
  }

  // 結果の入れ替わりの通知 (ADR-0017)。「最後に通知した条件」は `key={q}` で作り直されるページの
  // 外に持つ。ページに持たせると、debounce が明ける前の Enter や戻るで作り直された瞬間の条件を
  // 「直前と同じ」と見なして通知が消える。初期表示 (URL の q) は入れ替わりではないので通知しない
  const announcedQ = useRef(q);
  function handleResultsSettled(settledQ: string, count: number) {
    if (announcedQ.current === settledQ) {
      return;
    }
    announcedQ.current = settledQ;
    announce(noteSearchResultMessage(settledQ, count));
  }

  return (
    <NotesPage
      key={q}
      q={q}
      onQueryChange={handleQueryChange}
      onResultsSettled={handleResultsSettled}
    />
  );
}

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
 * 一覧ページ本体。`q` は URL で確定した検索語、`onQueryChange` は確定の要求 (submit)、
 * `onResultsSettled` は「この条件の一覧が取得済みで表示中」の報告 (通知するかは呼び出し側が決める)。
 *
 * 入力欄の値 `text` は緊急更新 (ADR-0014)。一覧は `text` を debounce (打鍵が止まるまで取得しない)
 * したうえで `useDeferredValue` に通す。新しい条件の取得で Suspend している間、React は古い
 * deferred 値で描き続けるので skeleton には落ちない (React docs `useDeferredValue` の Suspense
 * 統合。TanStack Query の Suspense ガイドと transition.test.tsx が同じ形を持つ。ADR-0033)。
 */
export function NotesPage({
  q,
  onQueryChange,
  onResultsSettled,
}: {
  q: string;
  onQueryChange: (q: string) => void;
  onResultsSettled: (q: string, count: number) => void;
}) {
  const [text, setText] = useState(q);
  const [debouncedText] = useDebouncedValue(text, { wait: NOTE_SEARCH_DEBOUNCE_MS });
  const deferredText = useDeferredValue(debouncedText);
  // key にする前に URL / server function と同じ正規化を通す (理由は toNoteListFilter の docstring)
  const filter = toNoteListFilter(deferredText);
  // 入力と表示中の条件がずれている間 (debounce の待ちと取得中) は古い一覧を印付きで残す。
  // 正規化後で比べる。生の文字列だと、submit で入力欄を揃えた直後に条件が同じまま印が出る
  const isStale = toNoteListFilter(text).q !== filter.q;
  const notesQuery = useSuspenseQuery(notesQueryOptions(filter));
  const queryClient = useQueryClient();

  // 条件の一覧が取得済みになったら報告する (通知は wrapper が出す。ADR-0017 / ADR-0033)。
  // 報告は live region への DOM 副作用の契機なので effect に置く。契機は条件と取得の決着で、
  // 件数は最新値を読むだけなので useEffectEvent に切り出す。取得中 (無効化済みキャッシュの
  // 再取得など) に報告すると古い件数を読み上げるので、決着まで待つ
  const settled = !notesQuery.isFetching;
  const reportResults = useEffectEvent((settledQ: string) => {
    onResultsSettled(settledQ, notesQuery.data.length);
  });
  useEffect(() => {
    if (settled) {
      reportResults(filter.q);
    }
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
    // 確定後の q が今の URL と同じなら navigate は履歴も作り直しも起こさない (Router が同一 location
    // を load だけにする)。入力欄も正規化後の値に揃えて、切り詰めが見えるようにする
    setText(next);
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
        title={PAGE_TITLE}
        actions={
          <>
            <NoteSearchField value={text} onValueChange={setText} onSubmit={handleSubmit} />
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
