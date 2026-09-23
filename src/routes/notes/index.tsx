import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { useRef } from "react";

import { noteListFilterSchema } from "@/features/notes/schema";
import { announce } from "@/lib/live-announcer";

import { NotesPage } from "./-components/notes-page";
import { NotesPagePending } from "./-components/notes-page-pending";
import { noteSearchResultMessage } from "./-lib/note-search";
import { loadNotesPageData } from "./-lib/notes-page-loader";

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
