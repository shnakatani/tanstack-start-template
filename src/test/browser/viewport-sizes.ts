/**
 * viewport の寸法。寸法はすべてここに置く。`vitest.browser.config.ts` が
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

/** 対応する最小画面幅。ここでレイアウトが崩壊しないことを下限として固定する */
export const NARROW_VIEWPORT: Viewport = { width: 375, height: 667 };
