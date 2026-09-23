import { cdp } from "vite-plus/test/browser/context";

declare global {
  /**
   * Base UI の animation スイッチ。`true` の間、閉じた popup は animate-out の完了を待たずに
   * unmount する (`@base-ui/react/internals/useAnimationsFinished`)。型は Base UI 同梱の
   * `global.d.ts` と同じ宣言だが、`index.d.ts` から参照されず program に入らないため再宣言する。
   */
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });
}

/**
 * ブラウザテストの既定 (ADR-0038)。`src/test/browser-setup.tsx` の `beforeEach` が毎テスト呼ぶ。
 * Base UI のスイッチ (上の宣言) と `prefers-reduced-motion: reduce` のエミュレーションを同時に
 * 立てる。後者は `src/styles.css` の reduced-motion ブロックが CSS の animation / transition を
 * 0.01ms にする。エミュレーションは page スコープで次のテストへ残るが、次の `beforeEach` が
 * 立て直すので戻す経路は持たない (`parkMouse` と同じ形)。
 */
export async function disableAnimations(): Promise<void> {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  await emulateReducedMotion("reduce");
}

/**
 * このテストの間だけ animation を戻す (ADR-0038)。閉じかけの popup が残る窓を検証するテストが
 * 本文の先頭で await する。次のテストの `beforeEach` が既定へ戻す。
 */
export async function enableAnimations(): Promise<void> {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
  await emulateReducedMotion("no-preference");
}
