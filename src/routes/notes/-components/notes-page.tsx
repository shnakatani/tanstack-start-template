import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useDeferredValue, useRef, useState } from "react";
import * as v from "valibot";

import { ButtonLink } from "@/components/parts/button-link";
import { DeleteConfirmDialog } from "@/components/parts/delete-confirm-dialog";
import { PageHeader } from "@/components/parts/page-header";
import { SectionErrorBoundary } from "@/components/parts/section-error-boundary";
import { parseDeletingIds } from "@/features/notes/deleting-ids";
import type { NoteDeleteTarget } from "@/features/notes/mutations";
import { noteMutationFilters, removeNoteMutation } from "@/features/notes/mutations";
import { NOTES_QUERY_KEY } from "@/features/notes/queries";
import { NOTE_ENTITY_LABEL, noteListFilterSchema } from "@/features/notes/schema";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { announce } from "@/lib/live-announcer";
import { toastMutationError } from "@/lib/mutation-error";

import { noteDeleteDialogHandle } from "../-lib/note-delete-dialog-handle";
import { noteCreateLinkProps } from "../-lib/note-dialog-focus";
import { NOTE_SEARCH_DEBOUNCE_MS, NOTES_RESULTS_ERROR_MESSAGE } from "../-lib/note-search";
import { NOTES_PAGE_TITLE } from "../-lib/notes-page-constants";
import { NoteSearchField } from "./note-search-field";
import { NotesResults } from "./notes-results";
import { NotesTableSkeleton } from "./notes-table-skeleton";

/** URL / server function と同じ schema で正規化する (trim / 上限)。 */
function normalizeQuery(text: string): string {
  return v.parse(noteListFilterSchema, { q: text }).q;
}

/**
 * 一覧ページ本体。`q` は URL で確定した検索語、`onQueryChange` は確定の要求 (submit)。
 * route ファイルから export せずここに置く (ADR-0010)。入力欄と一覧の流れは
 * docs/guides/lists-and-search.md「検索の入力欄を組む」、作り直さない決定と件数の通知は ADR-0027。
 */
export function NotesPage({ q, onQueryChange }: { q: string; onQueryChange: (q: string) => void }) {
  // URL の q が変わった世代。値ではなく世代で編集を紐付ける: 履歴は同じ値へ戻れるので、値で照合すると
  // 確定した後に戻ったとき古い編集が復活する。prop の変化は描画中に導く (React docs「Adjusting some
  // state when a prop changes」)
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
  const queryClient = useQueryClient();
  const isStale = draftQ !== deferredQ;

  const createLink = useRef<HTMLAnchorElement>(null);
  // 直前に件数を通知した検索語 (ADR-0027)。結果の部分は失敗からの回復で作り直されるので、ref はこちらが持つ。
  // 初期値が URL の q なので、初期表示は通知されない。区画の失敗の読み上げもその時点で最後に伝えたことなので、
  // 失敗したら null に戻し、回復後に表示された語を必ず通知する (ADR-0027)
  const announcedQ = useRef<string | null>(q);
  function claimAnnouncement(term: string): boolean {
    if (announcedQ.current === term) {
      return false;
    }
    announcedQ.current = term;
    return true;
  }

  const deleteMutation = useActionMutation({
    ...removeNoteMutation,
    // 開始の通知の置き場 (ADR-0026)。この画面は variables 方式 (ADR-0017) なのでキャッシュは触らない。
    // 開始は確定を押した直後なので、対象名を載せない
    onMutate: () => {
      announce("削除しています");
    },
    // 一覧の再取得は queryKey の前方一致に委ねる。別キーを渡すと削除後の一覧が古いままになる。
    // 再取得を await して pending を再取得完了まで保つ (ADR-0017)。閉じるのは確定時 (完了点「確定操作の直後」)
    onSuccess: async (_data, target) => {
      await queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
      // 行の消失は読み上げに出ないので、完了を通知する (ADR-0026)
      announce(`『${target.name}』を削除しました`);
    },
    // server の raw message は開発者向けの文言なので curate を通した固定文言だけを出す
    onError: toastMutationError,
  });

  function handleSubmit() {
    // 正規化で値が変わるときだけ入力欄を揃える (trim と切り詰めが見える)
    if (text !== draftQ) {
      setEdit({ generation, text: draftQ });
    }
    onQueryChange(draftQ);
  }

  // 完了点「確定操作の直後」: Action は close だけを含み、mutation は Transition の外で走らせる (ADR-0017)。
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
            <ButtonLink
              ref={createLink}
              from="/notes"
              to="/notes/new"
              // 一覧の絞り込みを保ったまま開き、閉じたら同じ一覧へ戻る
              search={(prev) => prev}
              {...noteCreateLinkProps()}
            >
              ＋ {NOTE_ENTITY_LABEL}を追加
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-1 flex-col p-4">
        {/* 検索の失敗は結果の部分で受け、検索欄と打った語を残す (ADR-0033)。resetKey は URL の q と
            deferredQ の組。打っただけで失敗した語を Enter で確定すると URL の q だけが変わり、
            deferredQ は同じ値のままなので、deferredQ だけでは境界が戻らず確定後の取得が描かれない。
            q は手書きの URL で改行を含み得るので、区切り文字で繋がず JSON にする */}
        <SectionErrorBoundary
          resetKey={JSON.stringify([q, deferredQ])}
          message={NOTES_RESULTS_ERROR_MESSAGE}
          onCatch={() => {
            announcedQ.current = null;
          }}
        >
          {/* 入る時は loader が待ち、条件の変化は useDeferredValue が前の結果を残すので、fallback が出るのは
              前の結果が無いまま suspend したときだけ */}
          <Suspense fallback={<NotesTableSkeleton />}>
            <NotesResults
              claimAnnouncement={claimAnnouncement}
              deferredQ={deferredQ}
              isStale={isStale}
            />
          </Suspense>
        </SectionErrorBoundary>
      </div>

      <DeleteConfirmDialog
        handle={noteDeleteDialogHandle}
        entityLabel={NOTE_ENTITY_LABEL}
        onConfirm={confirmDelete}
        fallbackFocusRef={createLink}
      />
    </div>
  );
}
