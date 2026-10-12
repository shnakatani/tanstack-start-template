import type { AnyRoute, RouterOptions, TrailingSlashOption } from "@tanstack/react-router";

/**
 * テスト用の router に渡す既定の options。テストで router を組むときは、`createRouter` の options の先頭で
 * spread する (`createRouter({ ...TEST_ROUTER_DEFAULTS, routeTree, history })`)。後に書いた options が勝つ。
 * テストで既定にしたい options は、各テストに書かずにここへ足す。
 *
 * 本番の設定 (`src/router.tsx`) を写す場所ではない。本番の既定を写すと二重管理になり、片方だけ変えたときに
 * テストだけが古い既定で緑になる。ここに置くのは、テストの実行を妨げる既定を打ち消す値だけにする。
 *
 * - `defaultPendingMinMs: 0`: pending 表示が出たときの最小表示時間 (既定 500ms) がテストの待ちに化けるのを防ぐ
 *   (TanStack/router#4569: https://github.com/TanStack/router/issues/4569)
 *
 * `satisfies` で router の options のキーと型に当てる。spread した値には余剰プロパティの検査が掛からないので、
 * 当てないとキーの綴りの誤りが黙って通る。
 */
export const TEST_ROUTER_DEFAULTS = {
  defaultPendingMinMs: 0,
} as const satisfies Partial<RouterOptions<AnyRoute, TrailingSlashOption>>;
