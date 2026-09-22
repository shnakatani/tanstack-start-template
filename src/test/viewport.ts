import { expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import type { Locator } from "vite-plus/test/browser/context";

import { viewportOverflows } from "./viewport-overflows";
import { DEFAULT_VIEWPORT, type Viewport } from "./viewport-sizes";

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
} from "./viewport-sizes";

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
 * 公式の `toBeInViewport({ ratio: 1 })` を使わない理由と実測は ADR-0032。
 */
export async function expectWithinViewport(target: Locator): Promise<void> {
  await expect
    .poll(() =>
      viewportOverflows(target.element().getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    )
    .toEqual([]);
}
