import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
  useParams,
  type AnyRouter,
  type ValidateNavigateOptions,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";
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
import {
  createDefaultViewTransition,
  ROUTE_DIALOG_CLOSE_TYPE,
  type RouteDialogMatchSource,
} from "@/lib/route-dialog-view-transition";
import { createRouterWithTestDefaults } from "@/test/app/create-router-with-test-defaults";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { recordFocusins } from "@/test/assert/focusin";
import { recordViewTransitions } from "@/test/assert/view-transitions";
import { enableAnimations } from "@/test/browser/animations";

import { useRouteDialog } from "./use-route-dialog";

/** 開いた元の要素に付ける印。ダイアログの route はこれで要素を探す */
function findByReturnMark(mark: string) {
  return () => document.querySelector<HTMLElement>(`[data-return-mark="${mark}"]`);
}

/**
 * hook の返り値を Dialog の Root と Popup へ渡す。「保存を始める」「保存に失敗する」は保存の mutation の pending を、
 * 「保存の応答で閉じる」は保存の `onSuccess` の `close()` を模す。キャンセルには `blocksClose` を渡さず、
 * 止める判定が hook の `onOpenChange` にあることを見る。描いた `close` は `closesByTitle` に残し、unmount の
 * あとに走る保存の `onSuccess` を模す。
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
}): ReactNode {
  const [savePending, setSavePending] = useState(false);
  const { close, onOpenChange, popupProps } = useRouteDialog<TRouter, TOptions>({
    ...options,
    isPending: savePending,
  });
  useEffect(() => {
    closesByTitle.set(title, close);
  });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent {...popupProps}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <input aria-label={`${title}の入力`} />
        <Button onClick={() => setSavePending(true)}>保存を始める</Button>
        <Button onClick={() => setSavePending(false)}>保存に失敗する</Button>
        <Button onClick={close}>保存の応答で閉じる</Button>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>キャンセル</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const closesByTitle = new Map<string, () => void>();

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
  staticData: { routeDialog: true },
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
  staticData: { routeDialog: true },
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
  staticData: { routeDialog: true },
  component: ItemNewDialog,
});
const itemImportRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/import",
  staticData: { routeDialog: true },
  component: ItemImportDialog,
});
const itemEditRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/$itemId/edit",
  staticData: { routeDialog: true },
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
    />
  );
}

// staticData の印を付け忘れたダイアログの route
const itemUnmarkedRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/unmarked",
  component: () => (
    <RouteDialogHarness
      title="印の無いダイアログ"
      returnTo={{ to: "/items" }}
      findReturnTarget={findByReturnMark("item-new")}
    />
  ),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  boardRoute.addChildren([boardIndexRoute, boardNewRoute]),
  groupItemsRoute.addChildren([groupItemNewRoute]),
  itemsRoute.addChildren([itemNewRoute, itemImportRoute, itemEditRoute, itemUnmarkedRoute]),
]);

interface DialogRouterOptions {
  trailingSlash?: "always" | "never" | "preserve";
  /** `src/router.tsx` と同じく、ダイアログを閉じる遷移の type を View Transition に渡す */
  viewTransition?: boolean;
}

function createDialogRouter(
  initialEntries: string[],
  { trailingSlash, viewTransition = false }: DialogRouterOptions = {},
) {
  const router = createRouterWithTestDefaults({
    routeTree,
    history: createMemoryHistory({ initialEntries, initialIndex: initialEntries.length - 1 }),
    trailingSlash,
    defaultViewTransition: viewTransition
      ? createDefaultViewTransition(new EventTarget(), currentRouter)
      : undefined,
  });
  return router;

  function currentRouter(): RouteDialogMatchSource {
    return router;
  }
}

type TestRouter = ReturnType<typeof createDialogRouter>;

/** `it.each` の表に並べる、開いたダイアログから離れる操作 */
interface LeaveDialog {
  leftBy: string;
  leave: (rendered: Awaited<ReturnType<typeof renderDialogRouter>>) => Promise<void> | void;
}

async function renderDialogRouter(initialEntries: string[], options?: DialogRouterOptions) {
  const router = createDialogRouter(initialEntries, options);
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

/** focusin を受けた要素の文字。モーダルの背後の要素は aria-hidden で、locator で引けない */
function textsOf(targets: Element[]) {
  return targets.map((target) => target.textContent);
}

describe("useRouteDialog の閉じ方", () => {
  it("閉じる操作の時点で、戻り先へ search を保って新しい履歴で離れる", async () => {
    const { router, screen } = await renderDialogRouter(["/items?q=a", "/items/new?q=a"]);

    await screen.getByRole("button", { name: "キャンセル" }).click();

    await expect.poll(() => router.state.location.href).toBe("/items?q=a");
    // 履歴を置き換えていれば、戻るとダイアログより前の一覧へ移る
    router.history.back();
    await expect.poll(() => router.state.location.href).toBe("/items/new?q=a");
  });

  it("読み込み中のダイアログを閉じると離れ、その後に読み込みが終わっても本物のダイアログを開かない", async () => {
    const load = Promise.withResolvers<undefined>();
    loadItem.mockReturnValueOnce(load.promise);
    const { router, screen } = await renderDialogRouter(["/items", "/items/1/edit"]);
    await expect.element(screen.getByRole("dialog", { name: "項目 1 を読み込み中" })).toBeVisible();

    await screen.getByRole("button", { name: "キャンセル" }).click();
    await expect.poll(() => router.state.location.pathname).toBe("/items");
    load.resolve(undefined);

    await expect.poll(() => router.state.status).toBe("idle");
    expect(router.state.location.pathname).toBe("/items");
    await expectAbsent(screen.getByRole("dialog"));
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

  it("保存の pending の間でも、保存の応答の close では離れる", async () => {
    const { router, screen } = await renderDialogRouter(["/items/new"]);
    await screen.getByRole("button", { name: "保存を始める" }).click();

    await screen.getByRole("button", { name: "保存の応答で閉じる" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/items");
  });

  it("戻るで離れて開き直したあと、前のダイアログの close を呼んでも離れない", async () => {
    // 前のテストで描いたダイアログの close を取り出さない
    closesByTitle.clear();
    const { router, screen } = await renderDialogRouter(["/items", "/items/new"]);
    const dialog = screen.getByRole("dialog", { name: "項目を追加" });
    await expect.element(dialog).toBeVisible();
    const closeBeforeLeaving = closesByTitle.get("項目を追加");
    expect.assert(closeBeforeLeaving);
    router.history.back();
    await expectRemoved(dialog);
    router.history.push("/items/new");
    await expect.element(screen.getByRole("dialog", { name: "項目を追加" })).toBeVisible();

    closeBeforeLeaving();

    // memory history では、navigate は blocker が無いと履歴へ同期で積む (`@tanstack/router-core` 1.171.34 の
    // `commitLocation`)。browser history は積むのを microtask へまとめる (`@tanstack/history` 1.162.4)
    expect(router.history.location.pathname).toBe("/items/new");
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

  it.each<LeaveDialog>([
    {
      leftBy: "閉じる操作",
      leave: async ({ screen }) => {
        await screen.getByRole("button", { name: "キャンセル" }).click();
      },
    },
    {
      leftBy: "戻る",
      leave: ({ router }) => {
        router.history.back();
      },
    },
  ])("$leftBy で離れたとき、開いた元の要素が無ければ、ページの見出しへ移す", async ({ leave }) => {
    // この router には route の announcer (ADR-0035) を置いていないので、移すのは hook である
    const rendered = await renderDialogRouter(["/items", "/items/9/edit"]);
    const { router, screen } = rendered;
    const dialog = screen.getByRole("dialog", { name: "項目 9 の編集" });
    await expect.element(dialog).toBeVisible();

    await leave(rendered);

    await expect.element(screen.getByRole("heading", { name: "項目" })).toHaveFocus();
    expect(router.state.location.pathname).toBe("/items");
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

  it.each([
    {
      trailingSlash: "never",
      // 戻り先は末尾の `/` を外して組まれ、履歴の pathname は `/` を持つ
      entries: ["/items/", "/items/new"],
      here: "/items/",
    },
    {
      trailingSlash: "always",
      // 戻り先は末尾に `/` を付けて組まれ、履歴の pathname は `/` を持たない
      entries: ["/items", "/items/new/"],
      here: "/items",
    },
  ] as const)(
    "trailingSlash が $trailingSlash のとき、末尾の `/` だけ違う URL の開く元のページへ戻るで離れても、開いた元の要素へ focus を戻す",
    async ({ trailingSlash, entries, here }) => {
      const { router, screen } = await renderDialogRouter([...entries], { trailingSlash });
      await expect.element(screen.getByRole("dialog", { name: "項目を追加" })).toBeVisible();

      router.history.back();

      await expect.element(screen.getByRole("button", { name: "項目を追加" })).toHaveFocus();
      expect(router.state.location.pathname).toBe(here);
    },
  );

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

function keyframeEffectsOf(animations: Animation[]): KeyframeEffect[] {
  return animations
    .map((animation) => animation.effect)
    .filter((effect): effect is KeyframeEffect => effect instanceof KeyframeEffect);
}

/** 閉じ方を比べる値。fill は旧画像が戻らないように変えているので比べない */
function readExitShape(effect: KeyframeEffect) {
  const keyframes = effect.getKeyframes();
  const last = keyframes.at(-1);
  return {
    duration: effect.getComputedTiming().duration,
    easing: keyframes.map((keyframe) => keyframe.easing),
    opacity: last?.opacity,
    transform: last?.transform,
  };
}

/**
 * 要素に `data-closed` が付いた時点で、その要素の閉じるアニメーションの形を読んで記録する。`getAnimations()` は
 * 呼んだ時点で style の変更を反映するので、属性が付いた直後の microtask でも閉じるアニメーションを返し、
 * 要素もまだ外れていない。`animationstart` で読まない理由は
 * docs/guides/testing/user-interactions.md「animation を戻すテストを書く」
 */
function recordClosingShapes(element: Element): ReturnType<typeof readExitShape>[] {
  const closing: ReturnType<typeof readExitShape>[] = [];
  const observer = new MutationObserver(() => {
    if (element.hasAttribute("data-closed")) {
      observer.disconnect();
      closing.push(...keyframeEffectsOf(element.getAnimations()).map(readExitShape));
    }
  });
  observer.observe(element, { attributeFilter: ["data-closed"] });
  onTestFinished(() => {
    observer.disconnect();
  });
  return closing;
}

/**
 * View Transition の擬似要素で始まった animation の形を、始まった時点で読んで記録する。操作の往復が遅いと、
 * 操作のあとに読む前に終わる。擬似要素の animation は、html に `pseudoElement` を付けた event で届く。
 * `ready` の直後にメインスレッドを 300ms 塞いでも、event の時点で読めた (2026-10-12、Chromium 153)
 */
function recordStartedTransitionShapes(pseudoElement: string): ReturnType<typeof readExitShape>[] {
  const element = document.documentElement;
  const started: ReturnType<typeof readExitShape>[] = [];
  // Element の addEventListener は animationstart の型を持たないので、受けた event を AnimationEvent に絞る
  const record = (event: Event) => {
    if (
      event instanceof AnimationEvent &&
      event.target === element &&
      event.pseudoElement === pseudoElement
    ) {
      started.push(
        ...keyframeEffectsOf(document.getAnimations())
          .filter(
            (effect) => effect.target === element && (effect.pseudoElement ?? "") === pseudoElement,
          )
          .map(readExitShape),
      );
    }
  };
  element.addEventListener("animationstart", record);
  onTestFinished(() => {
    element.removeEventListener("animationstart", record);
  });
  return started;
}

describe("useRouteDialog の閉じる遷移", () => {
  it.each<LeaveDialog>([
    {
      leftBy: "閉じる操作",
      leave: async ({ screen }) => {
        await screen.getByRole("button", { name: "キャンセル" }).click();
      },
    },
    {
      leftBy: "保存の応答",
      leave: async ({ screen }) => {
        await screen.getByRole("button", { name: "保存の応答で閉じる" }).click();
      },
    },
    {
      leftBy: "戻る",
      leave: ({ router }) => {
        router.history.back();
      },
    },
  ])("$leftBy で閉じると、閉じる遷移の type を付ける", async ({ leave }) => {
    const transitionOf = recordViewTransitions();
    const rendered = await renderDialogRouter(["/items", "/items/new"], { viewTransition: true });
    await expect.element(rendered.screen.getByRole("dialog", { name: "項目を追加" })).toBeVisible();

    const { types, transition } = await transitionOf(() => leave(rendered));

    expect(types).toEqual([ROUTE_DIALOG_CLOSE_TYPE]);
    await transition.finished;
  });

  it("読み込み中のダイアログを閉じても、閉じる遷移の type を付ける", async () => {
    const load = Promise.withResolvers<undefined>();
    loadItem.mockReturnValueOnce(load.promise);
    const transitionOf = recordViewTransitions();
    const { screen } = await renderDialogRouter(["/items", "/items/1/edit"], {
      viewTransition: true,
    });
    await expect.element(screen.getByRole("dialog", { name: "項目 1 を読み込み中" })).toBeVisible();

    const { types, transition } = await transitionOf(() =>
      screen.getByRole("button", { name: "キャンセル" }).click(),
    );

    expect(types).toEqual([ROUTE_DIALOG_CLOSE_TYPE]);
    await transition.finished;
    load.resolve(undefined);
  });

  it.each([
    { change: "開く", entries: ["/items"], next: "/items/new", opened: "項目を追加" },
    {
      change: "別のダイアログに替わる",
      entries: ["/items", "/items/1/edit"],
      next: "/items/new",
      opened: "項目を追加",
    },
    {
      change: "別の値の URL へ移る",
      entries: ["/items", "/items/1/edit"],
      next: "/items/2/edit",
      opened: "項目 2 の編集",
    },
  ])("$change ときは type を付けない", async ({ entries, next, opened }) => {
    const transitionOf = recordViewTransitions();
    const { router, screen } = await renderDialogRouter(entries, { viewTransition: true });
    await expect.poll(() => router.state.status).toBe("idle");

    const { types, transition } = await transitionOf(() => {
      router.history.push(next);
    });

    expect(types).toEqual([]);
    await transition.finished;
    await expect.element(screen.getByRole("dialog", { name: opened })).toBeVisible();
  });

  it("読み込み中のダイアログが本物に替わるときは type を付けない", async () => {
    const load = Promise.withResolvers<undefined>();
    loadItem.mockReturnValueOnce(load.promise);
    const transitionOf = recordViewTransitions();
    const { screen } = await renderDialogRouter(["/items", "/items/2/edit"], {
      viewTransition: true,
    });
    await expect.element(screen.getByRole("dialog", { name: "項目 2 を読み込み中" })).toBeVisible();

    const { types, transition } = await transitionOf(() => {
      load.resolve(undefined);
    });

    expect(types).toEqual([]);
    await transition.finished;
    await expect.element(screen.getByRole("dialog", { name: "項目 2 の編集" })).toBeVisible();
  });

  it("閉じる遷移で、Popup は registry の Dialog を閉じたときと同じ閉じ方で消え、ページは Overlay と同じ時間で切り替わる", async () => {
    enableAnimations();
    const registry = await render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>registry の Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const popup = registry.getByRole("dialog", { name: "registry の Dialog" }).element();
    const overlay = document.querySelector("[data-slot=dialog-overlay]");
    expect.assert(overlay);
    await Promise.all(popup.getAnimations().map((animation) => animation.finished));
    const popupExits = recordClosingShapes(popup);
    const overlayExits = recordClosingShapes(overlay);
    await registry.getByRole("button", { name: "Close" }).click();
    await expect.poll(() => popupExits).toHaveLength(1);
    await expect.poll(() => overlayExits).toHaveLength(1);
    const [popupExit] = popupExits;
    const [overlayExit] = overlayExits;
    expect.assert(popupExit);
    expect.assert(overlayExit);
    await registry.unmount();

    const transitionOf = recordViewTransitions();
    const { screen } = await renderDialogRouter(["/items", "/items/new"], { viewTransition: true });
    await expect.element(screen.getByRole("dialog", { name: "項目を追加" })).toBeVisible();
    // 開いたときの遷移の擬似要素を記録しない
    await document.activeViewTransition?.finished;
    const popupTransitions = recordStartedTransitionShapes("::view-transition-old(route-dialog)");
    const pageTransitions = recordStartedTransitionShapes("::view-transition-group(root)");
    const { transition } = await transitionOf(() =>
      screen.getByRole("button", { name: "キャンセル" }).click(),
    );
    await expect.poll(() => popupTransitions).toHaveLength(1);
    await expect.poll(() => pageTransitions).toHaveLength(1);
    const [popupTransition] = popupTransitions;
    const [pageTransition] = pageTransitions;
    expect.assert(popupTransition);
    expect.assert(pageTransition);

    expect(popupTransition).toEqual(popupExit);
    expect(pageTransition.duration).toBe(overlayExit.duration);
    await transition.finished;
  });

  it("route の staticData に印が無いと警告する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { screen } = await renderDialogRouter(["/items", "/items/unmarked"]);
    await expect.element(screen.getByRole("dialog", { name: "印の無いダイアログ" })).toBeVisible();

    expect(warn).toHaveBeenCalledWith(expect.any(String), { routeId: "/items/unmarked" });
  });
});
