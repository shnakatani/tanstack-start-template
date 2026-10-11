import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
  type AnyRouter,
  type ValidateNavigateOptions,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { expectRemoved } from "@/test/assert/absent";
import { recordFocusins } from "@/test/assert/focusin";
import { slowDownClosingDialogs } from "@/test/browser/closing-dialogs";

import { useRouteDialog } from "./use-route-dialog";

/** 開いた元の要素に付ける印。ダイアログの route はこれで要素を探す */
function findByReturnMark(mark: string) {
  return () => document.querySelector<HTMLElement>(`[data-return-mark="${mark}"]`);
}

/**
 * hook の返り値を Dialog の Root と Popup へ渡す。「保存を始める」「保存に失敗する」は保存の mutation の pending を、
 * 「保存の応答で閉じる」は保存の `onSuccess` の `setOpen(false)` を模す。キャンセルには `blocksClose` を渡さず、
 * 止める判定が hook の `onOpenChange` にあることを見る。
 * 戻り先はこのファイルの router の route で検査する。router の型を固定せず型引数の既定にするのは、hook の公開の
 * signature と同じ形にするため。固定すると `search: (prev) => prev` が型検査を通らない (2026-10-12、
 * `@tanstack/react-router` 1.170.41)
 */
function RouteDialogHarness<TRouter extends AnyRouter = TestRouter, TOptions = unknown>({
  title,
  ...options
}: {
  title: string;
  returnTo: ValidateNavigateOptions<TRouter, TOptions>;
  findReturnTarget: () => HTMLElement | null;
  waitForCloseAnimation?: boolean;
}): ReactNode {
  const [savePending, setSavePending] = useState(false);
  const { open, setOpen, onOpenChange, onOpenChangeComplete, finalFocus } = useRouteDialog<
    TRouter,
    TOptions
  >({ ...options, isPending: savePending });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <input aria-label={`${title}の入力`} />
        <Button onClick={() => setSavePending(true)}>保存を始める</Button>
        <Button onClick={() => setSavePending(false)}>保存に失敗する</Button>
        <Button onClick={() => setOpen(false)}>保存の応答で閉じる</Button>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <h1>ホーム</h1>,
});

// 開く元のページを layout route に置き、その下に index route とダイアログの route を並べる形
const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: BoardPage,
});
const boardIndexRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: "/",
  component: () => <p>ボードの一覧</p>,
});
const boardNewRoute = createRoute({
  getParentRoute: () => boardRoute,
  path: "/new",
  component: BoardNewDialog,
});

function BoardPage(): ReactNode {
  return (
    <>
      <h1>ボード</h1>
      <button type="button" data-return-mark="board-new">
        ボードに追加
      </button>
      <Outlet />
    </>
  );
}

function BoardNewDialog(): ReactNode {
  return (
    <RouteDialogHarness
      title="ボードに追加"
      returnTo={{ to: "/board" }}
      findReturnTarget={findByReturnMark("board-new")}
    />
  );
}

// 開く元のページの親に path params がある形。戻り先は今の params を引き継ぐ
const groupItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/groups/$groupId/items",
  component: GroupItemsPage,
});
const groupItemNewRoute = createRoute({
  getParentRoute: () => groupItemsRoute,
  path: "/new",
  component: GroupItemNewDialog,
});

function GroupItemsPage(): ReactNode {
  // route の `useParams` はアプリの router の型で引くので、この router の型を渡す
  const { groupId } = useParams<TestRouter, "/groups/$groupId/items">({
    from: "/groups/$groupId/items",
  });
  return (
    <>
      <h1>{groupId} の項目</h1>
      <button type="button" data-return-mark="group-item-new">
        {groupId} に追加
      </button>
      <Outlet />
    </>
  );
}

function GroupItemNewDialog(): ReactNode {
  return (
    <RouteDialogHarness
      title="グループに追加"
      // from が無いと、params の関数の prev が groupId を持つと分からず、型検査を通らない
      returnTo={{
        from: "/groups/$groupId/items/new",
        to: "/groups/$groupId/items",
        params: (prev) => prev,
      }}
      findReturnTarget={findByReturnMark("group-item-new")}
    />
  );
}

// 開く元のページの直下に、ダイアログの route を平らに置く形 (`items/$itemId.edit.tsx`)。開く元のページは search を持つ
const ITEM_IDS = ["1", "2"];
const loadItem = vi.fn<(itemId: string) => Promise<undefined> | undefined>();

const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items",
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" ? { q: search.q } : {},
  component: ItemsPage,
});
const itemNewRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/new",
  component: ItemNewDialog,
});
const itemImportRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/import",
  component: ItemImportDialog,
});
const itemEditRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/$itemId/edit",
  loader: ({ params }) => loadItem(params.itemId),
  remountDeps: ({ params }) => params,
  pendingMs: 0,
  pendingComponent: ItemEditPendingDialog,
  component: ItemEditDialog,
});

function ItemsPage(): ReactNode {
  return (
    <>
      <h1>項目</h1>
      <button type="button" data-return-mark="item-new">
        項目を追加
      </button>
      <button type="button" data-return-mark="item-import">
        項目を取り込む
      </button>
      {ITEM_IDS.map((itemId) => (
        <button key={itemId} type="button" data-return-mark={`item-edit-${itemId}`}>
          項目 {itemId} を編集
        </button>
      ))}
      <Outlet />
    </>
  );
}

function ItemNewDialog(): ReactNode {
  return (
    <RouteDialogHarness
      title="項目を追加"
      returnTo={{ to: "/items", search: (prev) => prev }}
      findReturnTarget={findByReturnMark("item-new")}
    />
  );
}

function ItemImportDialog(): ReactNode {
  return (
    <RouteDialogHarness
      title="項目を取り込む"
      returnTo={{ to: ".." }}
      findReturnTarget={findByReturnMark("item-import")}
    />
  );
}

function ItemEditDialog(): ReactNode {
  const { itemId } = useParams<TestRouter, "/items/$itemId/edit">({ from: "/items/$itemId/edit" });
  return (
    <RouteDialogHarness
      title={`項目 ${itemId} の編集`}
      returnTo={{ to: "/items", search: (prev) => prev }}
      findReturnTarget={findByReturnMark(`item-edit-${itemId}`)}
    />
  );
}

function ItemEditPendingDialog(): ReactNode {
  const { itemId } = useParams<TestRouter, "/items/$itemId/edit">({ from: "/items/$itemId/edit" });
  return (
    <RouteDialogHarness
      title={`項目 ${itemId} を読み込み中`}
      returnTo={{ to: "/items", search: (prev) => prev }}
      findReturnTarget={findByReturnMark(`item-edit-${itemId}`)}
      waitForCloseAnimation={false}
    />
  );
}

const routeTree = rootRoute.addChildren([
  homeRoute,
  boardRoute.addChildren([boardIndexRoute, boardNewRoute]),
  groupItemsRoute.addChildren([groupItemNewRoute]),
  itemsRoute.addChildren([itemNewRoute, itemImportRoute, itemEditRoute]),
]);

function createDialogRouter(initialEntries: string[]) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries, initialIndex: initialEntries.length - 1 }),
    defaultPendingMinMs: 0,
  });
}

type TestRouter = ReturnType<typeof createDialogRouter>;

async function renderDialogRouter(initialEntries: string[]) {
  const router = createDialogRouter(initialEntries);
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

/** focusin を受けた要素の文字。モーダルの背後の要素は aria-hidden で、locator で引けない */
function textsOf(targets: Element[]) {
  return targets.map((target) => target.textContent);
}

describe("useRouteDialog の開閉", () => {
  it("閉じる操作のあと、閉じるアニメーションの間は戻り先へ離れない", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    const { router, screen } = await renderDialogRouter(["/items/new"]);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(slowedWhileClosing).toBe(true);
    expect(router.state.location.pathname).toBe("/items/new");
  });

  it("閉じ終えたら、戻り先へ search を保って新しい履歴で離れる", async () => {
    const { router, screen } = await renderDialogRouter(["/items?q=a", "/items/new?q=a"]);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(() => router.state.location.href).toBe("/items?q=a");
    // 履歴を置き換えていれば、戻るとダイアログより前の一覧へ移る
    router.history.back();
    await expect.poll(() => router.state.location.href).toBe("/items/new?q=a");
  });

  it("waitForCloseAnimation が false なら、閉じる操作の時点で離れる", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    loadItem.mockReturnValueOnce(Promise.withResolvers<undefined>().promise);
    const { router, screen } = await renderDialogRouter(["/items", "/items/1/edit"]);
    await expect.element(screen.getByRole("dialog", { name: "項目 1 を読み込み中" })).toBeVisible();

    await screen.getByRole("button", { name: "キャンセル" }).click();

    // 閉じるアニメーションは 60 秒に延ばしてあるので、離れたならアニメーションの終わりを待っていない
    await expect.poll(() => router.state.location.pathname).toBe("/items");
    expect(slowedWhileClosing()).toBe(true);
  });

  it("waitForCloseAnimation が false なら、setOpen(false) で閉じた時点でも離れる", async () => {
    const slowedWhileClosing = slowDownClosingDialogs();
    loadItem.mockReturnValueOnce(Promise.withResolvers<undefined>().promise);
    const { router, screen } = await renderDialogRouter(["/items", "/items/1/edit"]);
    await expect.element(screen.getByRole("dialog", { name: "項目 1 を読み込み中" })).toBeVisible();

    await screen.getByRole("button", { name: "保存の応答で閉じる" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/items");
    expect(slowedWhileClosing()).toBe(true);
  });

  it("保存の pending の間は Escape で閉じず、pending が終わると閉じて離れる", async () => {
    const { router, screen } = await renderDialogRouter(["/items/new"]);
    await screen.getByRole("button", { name: "保存を始める" }).click();

    await userEvent.keyboard("{Escape}");
    // Escape で閉じていれば、ダイアログは外れていて押せない
    await screen.getByRole("button", { name: "保存に失敗する" }).click();
    expect(router.state.location.pathname).toBe("/items/new");

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => router.state.location.pathname).toBe("/items");
  });

  it("保存の pending の間でも、保存の応答の setOpen(false) では閉じて離れる", async () => {
    const { router, screen } = await renderDialogRouter(["/items/new"]);
    await screen.getByRole("button", { name: "保存を始める" }).click();

    await screen.getByRole("button", { name: "保存の応答で閉じる" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/items");
  });
});

const ROUTE_SHAPES = [
  {
    shape: "layout route の下に index route とダイアログの route を並べる形",
    page: "/board",
    dialog: "/board/new",
    returnTarget: "ボードに追加",
  },
  {
    shape: "親に path params がある形",
    page: "/groups/g1/items",
    dialog: "/groups/g1/items/new",
    returnTarget: "g1 に追加",
  },
  {
    shape: "ダイアログの route を開く元のページの直下に平らに置く形",
    page: "/items",
    dialog: "/items/1/edit",
    returnTarget: "項目 1 を編集",
  },
  {
    shape: "戻り先を相対の to (`..`) で書く形",
    page: "/items",
    dialog: "/items/import",
    returnTarget: "項目を取り込む",
  },
];

describe("useRouteDialog の閉じたときの focus", () => {
  it.each(ROUTE_SHAPES)(
    "$shape: URL を直接開いて閉じると、戻り先へ離れ、開いた元の要素へ focus を移す",
    async ({ page, dialog, returnTarget }) => {
      const { router, screen } = await renderDialogRouter([dialog]);

      await screen.getByRole("button", { name: "キャンセル" }).click();

      await expect.element(screen.getByRole("button", { name: returnTarget })).toHaveFocus();
      expect(router.state.location.pathname).toBe(page);
    },
  );

  it.each(ROUTE_SHAPES)(
    "$shape: 戻るで離れると、開いた元の要素へ focus を戻す",
    async ({ page, dialog, returnTarget }) => {
      const { router, screen } = await renderDialogRouter([page, dialog]);
      await expect.element(screen.getByRole("dialog")).toBeVisible();

      router.history.back();

      await expect.element(screen.getByRole("button", { name: returnTarget })).toHaveFocus();
    },
  );

  it("閉じたとき、開いた元の要素が無ければ、ページの見出しへ移す", async () => {
    const { screen } = await renderDialogRouter(["/items/9/edit"]);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.element(screen.getByRole("heading", { name: "項目" })).toHaveFocus();
  });

  it("戻るで離れたとき、開いた元の要素が無ければ、focus に触れない", async () => {
    const { router, screen } = await renderDialogRouter(["/items", "/items/9/edit"]);
    const dialog = screen.getByRole("dialog", { name: "項目 9 の編集" });
    await expect.element(dialog).toBeVisible();

    router.history.back();

    await expectRemoved(dialog);
    expect(document.activeElement).toBe(document.body);
  });

  it("戻り先の path params を今の値から引き継ぐので、別の値の開く元のページへ戻っても、離れたとしてそのページの要素へ移す", async () => {
    const { router, screen } = await renderDialogRouter([
      "/groups/g2/items",
      "/groups/g1/items/new",
    ]);
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    router.history.back();

    await expect.element(screen.getByRole("button", { name: "g2 に追加" })).toHaveFocus();
  });

  it("router が大文字小文字を区別しないとき、大文字小文字の違う URL の開く元のページへ戻るで離れても、開いた元の要素へ focus を戻す", async () => {
    const { router, screen } = await renderDialogRouter(["/Items", "/Items/new"]);
    await expect.element(screen.getByRole("dialog", { name: "項目を追加" })).toBeVisible();

    router.history.back();

    await expect.element(screen.getByRole("button", { name: "項目を追加" })).toHaveFocus();
    // 比べる 2 つの pathname が、大文字小文字だけ違う形で並んでいたことを示す
    expect(router.state.location.pathname).toBe("/Items");
  });

  it("戻り先の path params を持たない別のページへ離れたら、focus に触れない", async () => {
    const { router, screen } = await renderDialogRouter(["/", "/groups/g1/items/new"]);
    const dialog = screen.getByRole("dialog");
    await expect.element(dialog).toBeVisible();

    router.history.back();

    await expect.element(screen.getByRole("heading", { name: "ホーム" })).toBeVisible();
    await expectRemoved(dialog);
    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    { replacedBy: "別のダイアログの URL", next: "/items/new", input: "項目を追加の入力" },
    { replacedBy: "別の値の URL", next: "/items/2/edit", input: "項目 2 の編集の入力" },
  ])(
    "開いたまま $replacedBy へ移ると、開いた元の要素を経ずに替わる側の入力欄へ focus が移る",
    async ({ next, input }) => {
      const { router, screen } = await renderDialogRouter(["/items", "/items/1/edit"]);
      await expect
        .element(screen.getByRole("textbox", { name: "項目 1 の編集の入力" }))
        .toHaveFocus();
      const focused = recordFocusins();

      router.history.push(next);

      await expect.element(screen.getByRole("textbox", { name: input })).toHaveFocus();
      expect(textsOf(focused)).not.toContain("項目 1 を編集");
    },
  );

  it("読み込み中のダイアログが本物に替わると、開いた元の要素を経ずに入力欄へ focus が移る", async () => {
    const load = Promise.withResolvers<undefined>();
    loadItem.mockReturnValueOnce(load.promise);
    const { screen } = await renderDialogRouter(["/items", "/items/2/edit"]);
    await expect
      .element(screen.getByRole("textbox", { name: "項目 2 を読み込み中の入力" }))
      .toHaveFocus();
    const focused = recordFocusins();

    load.resolve(undefined);

    await expect
      .element(screen.getByRole("textbox", { name: "項目 2 の編集の入力" }))
      .toHaveFocus();
    expect(textsOf(focused)).not.toContain("項目 2 を編集");
  });
});
