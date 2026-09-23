import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import * as v from "valibot";

import { notesQueryOptions } from "@/features/notes/queries";
import { noteListFilterSchema } from "@/features/notes/schema";

import { NotesPage } from "./-components/notes-page";
import { NotesPagePending } from "./-components/notes-page-pending";

export const Route = createFileRoute("/notes/")({
  // URL の search を schema で検証する。valibot 1.x は Standard Schema なので adapter 不要
  validateSearch: noteListFilterSchema,
  // 既定値は URL に書かない。/notes と /notes?q= を同じ場所にする。既定は schema から導く
  search: { middlewares: [stripSearchParams(v.getDefaults(noteListFilterSchema))] },
  // loader が読む search は deps として宣言する。deps が変わると loader が走り直し、条件ごとに
  // 別のキャッシュになる (Router docs「Using loaderDeps to access search params」)
  loaderDeps: ({ search }) => ({ q: search.q }),
  // staleTime: "static" はこの呼び出しだけに効く (キャッシュがあれば返し、無ければ取得する)。
  // queryOptions 側に書くと observer の再取得まで止まる
  loader: ({ context, deps }) =>
    context.queryClient.query({ ...notesQueryOptions(deps), staleTime: "static" }),
  pendingComponent: NotesPagePending,
  component: NotesRoute,
});

/** Route hooks を吸収する薄い wrapper。ページ本体は値とハンドラを props で受ける (ADR-0012 / ADR-0033)。 */
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
