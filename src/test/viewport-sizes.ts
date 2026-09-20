/**
 * viewport の寸法。`vitest.browser.config.ts` と `vitest.storybook.config.ts` が
 * `browser.viewport` として読むため、`vite-plus/test/browser` を import しない。
 * `src/test/viewport.ts` は browser mode でしか動かず、config から読むと
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
