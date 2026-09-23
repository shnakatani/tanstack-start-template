import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { noteListFilterSchema } from "@/features/notes/schema";

import { NotesPage } from "./-components/notes-page";
import { NotesPagePending } from "./-components/notes-page-pending";
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
 * Route hooks を吸収する薄い wrapper。ページ本体は値とハンドラを props で受ける (ADR-0012)。
 * `key={q}` でページを作り直さない。
 * URL の q に入力欄を揃えるのはページ側が描画中に導く (ADR-0033)
 */
function NotesRoute() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  function handleQueryChange(next: string) {
    // navigate は Router が startTransition で commit する (ADR-0014)。確定は利用者の明示操作
    // (submit) 1 回につき履歴 1 つで、戻るボタンが絞り込み前の一覧に戻る (ADR-0033)
    void navigate({ search: (prev) => ({ ...prev, q: next }) });
  }
  return <NotesPage q={q} onQueryChange={handleQueryChange} />;
}
