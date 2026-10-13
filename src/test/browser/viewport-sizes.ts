/**
 * viewport の寸法。寸法はすべてここに置く。`tooling/test/browser-project.ts` が
 * `DEFAULT_VIEWPORT` を `browser.viewport` として読むため、このファイルは
 * `vite-plus/test/browser` を import しない。
 * `src/test/assert/viewport.ts` は browser mode でしか動かず、config から読むと
 * 「vitest/browser can be imported only inside the Browser Mode」で落ちる (2026-09-20 実測)。
 */
export interface Viewport {
  width: number;
  height: number;
}

/** ブラウザテストの既定 viewport */
export const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 720 };

/** タブレット想定のレイアウト検証に使う viewport (既定より縦に長い経路を通す) */
export const TABLET_VIEWPORT: Viewport = { width: 1280, height: 853 };

/** 極端に低い viewport (ブラウザ UI 領域が大きい環境の下限想定) */
export const SHORT_VIEWPORT: Viewport = { width: 1280, height: 420 };

/** 既定と最小の間の幅。一覧の table のように、余りの幅の配り方が viewport で変わる部品を既定の幅と並べて測る */
export const MEDIUM_VIEWPORT: Viewport = { width: 760, height: 720 };

/** 対応する最小画面幅。ここでレイアウトが崩壊しないことを下限として固定する */
export const NARROW_VIEWPORT: Viewport = { width: 375, height: 667 };

/**
 * WCAG 2.2 の 1.4.10 Reflow が判定に使う寸法。1280×1024 を 400% に拡大した 320×256 で
 * (Understanding 1.4.10 の Note 1)、この幅で縦の scroll だけで読めることを見る。
 * 対応する最小画面幅の `NARROW_VIEWPORT` とは別の基準で、どちらかを変えてももう一方は変えない
 */
export const REFLOW_VIEWPORT: Viewport = { width: 320, height: 256 };
