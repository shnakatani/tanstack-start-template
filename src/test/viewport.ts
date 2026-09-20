import { expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { DEFAULT_VIEWPORT, type Viewport } from "./viewport-sizes";

/**
 * ブラウザテストのレイアウト検証で使う viewport の操作とアサーション。寸法は
 * `viewport-sizes.ts` が持ち、テストが 1 つの import で済むようここから再 export する。
 * 変更したテストは afterEach で必ず `restoreDefaultViewport` を通す
 * (戻さないと後続ファイルのブレークポイント依存テストが巻き添えになる)。
 */

export type { Viewport } from "./viewport-sizes";
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
 * 要素の矩形が viewport 内に収まっていることを検証する。
 * 高さ・幅が 0 に潰れた要素は「はみ出していない」を自明に満たしてしまうため、
 * 実体があること (height > 0 かつ width > 0) も併せて要求する。
 */
export function expectWithinViewport(element: Element): void {
  const rect = element.getBoundingClientRect();
  expect(rect.height, "rect.height").toBeGreaterThan(0);
  expect(rect.width, "rect.width").toBeGreaterThan(0);
  expect(rect.top, "rect.top").toBeGreaterThanOrEqual(0);
  expect(rect.left, "rect.left").toBeGreaterThanOrEqual(0);
  expect(rect.bottom, "rect.bottom").toBeLessThanOrEqual(window.innerHeight);
  expect(rect.right, "rect.right").toBeLessThanOrEqual(window.innerWidth);
}
