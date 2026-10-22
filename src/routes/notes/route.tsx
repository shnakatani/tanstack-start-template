import { noop } from "@tanstack/react-query";
import { Outlet, createFileRoute, stripSearchParams } from "@tanstack/react-router";
import * as v from "valibot";

import { notesQueryOptions } from "@/features/notes/queries";
import { noteListFilterSchema } from "@/features/notes/schema";
import { pageHead } from "@/lib/page-title";

import { NotesPage } from "./-components/notes-page";
import { NotesPagePending } from "./-components/notes-page-pending";
import { noteListSearchSchema } from "./-lib/note-search";
import { NOTES_PAGE_TITLE } from "./-lib/notes-page-constants";

export const Route = createFileRoute("/notes")({
  // URL の search を schema で検証する。valibot 1.x は Standard Schema なので adapter 不要。
  // 文字列でない q は既定に落とす (ADR-0019)
  validateSearch: noteListSearchSchema,
  // 既定値は URL に書かない。/notes と /notes?q= を同じ場所にする。既定は schema から導く
  search: { middlewares: [stripSearchParams(v.getDefaults(noteListFilterSchema))] },
  // loader が読む search は deps として宣言する。deps が変わると loader が走り直し、条件ごとに
  // 別のキャッシュになる (Router docs「Using loaderDeps to access search params」)
  loaderDeps: ({ search }) => ({ q: search.q }),
  // stay (同じ route に留まる読み込み) では待たずに流し、失敗はページの中の境界が結果の部分で受ける
  // (ADR-0033)。この一覧の query は head の値・notFound・redirect・認可のどれも決めないので、待たなくてよい。
  // staleTime: "static" はこの呼び出しだけに効く (キャッシュがあれば返し、無ければ取得する)。
  // queryOptions 側に書くと observer の再取得まで止まる。値は head が使わないので返さない
  loader: async ({ context, deps, cause }) => {
    const fetching = context.queryClient.query({ ...notesQueryOptions(deps), staleTime: "static" });
    if (cause === "stay") {
      void fetching.catch(noop);
      return;
    }
    await fetching;
  },
  staticData: { pageName: NOTES_PAGE_TITLE },
  head: pageHead,
  pendingComponent: NotesPagePending,
  component: NotesRoute,
});

/** Route hooks を吸収する薄い wrapper。ページ本体は値とハンドラを props で受ける (ADR-0010 / docs/guides/testing/real-router.md「route の wrapper をテストする」)。 */
function NotesRoute() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  function handleQueryChange(next: string) {
    // navigate は Router が startTransition で commit する (ADR-0015)。検索は同じ画面の絞り込みなので
    // 履歴を積まない (replace)。戻るは 1 つ前の画面へ戻る (ADR-0019)
    void navigate({ search: (prev) => ({ ...prev, q: next }), replace: true });
  }
  // 子 route (一覧の上に重ねるダイアログ) は一覧の後ろに描く。一覧は開閉の間も描いたまま残す
  return (
    <>
      <NotesPage q={q} onQueryChange={handleQueryChange} />
      <Outlet />
    </>
  );
}
