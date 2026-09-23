import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { notesQueryOptions } from "@/features/notes/queries";
import { noteListFilterSchema } from "@/features/notes/schema";

import { NotesPage } from "./-components/notes-page";
import { NotesPagePending } from "./-components/notes-page-pending";

export const Route = createFileRoute("/notes/")({
  // URL の search を schema で検証する。valibot 1.x は Standard Schema なので adapter 不要
  validateSearch: noteListFilterSchema,
  // 既定値 (q="") は URL に書かない。/notes と /notes?q= を同じ場所にする
  search: { middlewares: [stripSearchParams({ q: "" })] },
  // loader が読む search は deps として宣言する。deps が変わると loader が走り直し、条件ごとに
  // 別のキャッシュになる (Router docs「Using loaderDeps to access search params」)
  loaderDeps: ({ search }) => ({ q: search.q }),
  // options に直接書くと context (root の queryClient) と deps の型が推論される。関数に切り出すと
  // 引数の型を手で書くことになる (typeof Route は循環、LoaderFnContext は AnyRoute 経由で any)。
  // loader は既定では code-split の対象外で、どこに書いても main bundle に入る。検証は router 経由
  // (index.test.tsx「URL の q が loader と入力欄に届く」)。
  // staleTime: "static" はこの呼び出しだけに効き、キャッシュがあれば必ずそれを返す (無ければ取得する)。
  // queryOptions 側の staleTime を書き換えると observer の再取得まで止まるため、上書きは呼び出し側に置く
  loader: ({ context, deps }) =>
    context.queryClient.query({ ...notesQueryOptions(deps), staleTime: "static" }),
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
