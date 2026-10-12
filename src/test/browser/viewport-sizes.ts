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

/**
 * 一覧の table が余白を持たず、列が中身の幅へ詰まる中間の幅。auto layout の列幅は viewport の余りの配分で
 * 決まるので、既定の幅だけで測ると、詰まった幅で中身の変化が列へ別の量で伝わることを見逃す。
 * 操作の列のボタンが 50px から 70px になったときの列の移動は、1280px では +34px (2026-10-12、dev server を
 * Playwright の page で開いて測った) と +26.2px (2026-10-13、テストの iframe)、760px では +20px
 * (2026-10-13、テストの iframe) だった
 */
export const MEDIUM_VIEWPORT: Viewport = { width: 760, height: 720 };

/** 対応する最小画面幅。ここでレイアウトが崩壊しないことを下限として固定する */
export const NARROW_VIEWPORT: Viewport = { width: 375, height: 667 };
