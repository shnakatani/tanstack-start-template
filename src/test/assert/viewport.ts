import { expect, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import type { Locator } from "vite-plus/test/browser/context";

import { DEFAULT_VIEWPORT, type Viewport } from "../browser/viewport-sizes";
import { viewportOverflows } from "./viewport-overflows";

/**
 * ブラウザテストのレイアウト検証で使う viewport の操作とアサーション。寸法は
 * `viewport-sizes.ts` が持ち、テストが 1 つの import で済むようここから再 export する。
 * 変更したテストは afterEach で必ず `restoreDefaultViewport` を通す
 * (戻さないと後続ファイルのブレークポイント依存テストが巻き添えになる)。
 */

export {
  DEFAULT_VIEWPORT,
  NARROW_VIEWPORT,
  SHORT_VIEWPORT,
  TABLET_VIEWPORT,
} from "../browser/viewport-sizes";

/**
 * viewport を切り替える。定数と `page.viewport()` の引数展開を 1 箇所に閉じ、
 * width と height の取り違えが個々のテストで起きないようにする。
 */
export async function setViewport(viewport: Viewport): Promise<void> {
  await page.viewport(viewport.width, viewport.height);
}

/** afterEach から呼ぶ。既定 viewport へ戻す。 */
export async function restoreDefaultViewport(): Promise<void> {
  await setViewport(DEFAULT_VIEWPORT);
}

/**
 * 要素の矩形が viewport 内に収まっていることを検証する。判定は `viewportOverflows` (純粋) が
 * 持ち、ここは locator から矩形を読んで poll する。空配列を期待するので、失敗文にはみ出した
 * 辺と px が残る。要素が無ければ `element()` が throw し、予算ぶん retry してから落ちる。
 *
 * 公式の `toBeInViewport({ ratio: 1 })` を使わない理由は
 * `docs/guides/testing/waiting-and-assertions.md`「viewport の収まりを自前の helper で測る理由」。
 */
export const expectWithinViewport = vi.defineHelper(async (target: Locator): Promise<void> => {
  await expect
    .poll(() =>
      viewportOverflows(target.element().getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    )
    .toEqual([]);
});
