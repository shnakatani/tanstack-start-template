import {
  createRouter,
  type AnyRoute,
  type RouterOptions,
  type TrailingSlashOption,
} from "@tanstack/react-router";

/**
 * テスト用の router の既定の options。テストで既定にしたい options は、各テストに書かずにここへ足す。
 *
 * 本番の設定 (`src/router.tsx`) は写さない。写すと二重管理になり、片方だけ変えたときにテストだけが古い既定で
 * 緑になる。ここに置くのは、テストの実行を妨げる既定を打ち消す値だけにする。
 *
 * - `defaultPendingMinMs: 0`: pending 表示が出たときの最小表示時間 (既定 500ms) がテストの待ちに化けるのを防ぐ
 *   (TanStack/router#4569: https://github.com/TanStack/router/issues/4569)
 *
 * `satisfies` で router の options のキーと型に当てる。呼ぶ側の options の型は generics なので、それと並べて
 * 展開したオブジェクトには余剰プロパティの検査が掛からず、当てないとキーの綴りの誤りが黙って通る。
 */
const TEST_ROUTER_DEFAULTS = {
  defaultPendingMinMs: 0,
} as const satisfies Partial<RouterOptions<AnyRoute, TrailingSlashOption>>;

/**
 * テスト用の既定を入れた `createRouter`。テストで router を組むときは `createRouter` の代わりにこれを呼ぶ
 * (`createRouterWithTestDefaults({ routeTree, history })`)。型は `createRouter` と同じなので、route tree からの
 * 型の推論も、呼ぶ側が渡す options の型の検査も、`createRouter` を直接呼ぶときと変わらない。
 * 既定を先に、呼ぶ側の options を後に展開するので、呼ぶ側が渡した値が既定に勝つ。
 */
export const createRouterWithTestDefaults: typeof createRouter = (options) =>
  createRouter({ ...TEST_ROUTER_DEFAULTS, ...options });
