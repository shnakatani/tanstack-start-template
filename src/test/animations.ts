import { cdp } from "vite-plus/test/browser/context";

declare global {
  /**
   * Base UI の animation スイッチ。`true` の間、閉じた popup は animate-out の完了を待たずに
   * unmount する (`@base-ui/react/internals/useAnimationsFinished`)。型は Base UI 同梱の
   * `global.d.ts` と同じ宣言だが、`index.d.ts` から参照されず program に入らないため再宣言する。
   */
  // oxlint-disable-next-line no-var -- declare global の中で globalThis のプロパティになるのは var だけ
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

const REDUCED_MOTION = "prefers-reduced-motion";

async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: REDUCED_MOTION, value }] });
}

/**
 * ブラウザテストの既定 (ADR-0018)。`src/test/browser-setup.tsx` の `beforeEach` が毎テスト呼ぶ。
 * 2 つの機構を同時に止める。
 *
 * - Base UI の animation スイッチ。閉じた popup が animate-out の完了を待たずに unmount する
 * - `prefers-reduced-motion: reduce` のエミュレーション。`src/styles.css` の reduced-motion ブロックが
 *   CSS の animation / transition を 0.01ms にするので、hover や開閉の途中値を読まない
 *
 * エミュレーションは page スコープで後続ファイルへ漏れる。`browser-setup.tsx` の `afterEach` が
 * `features: []` で戻し、次の `beforeEach` がまた立てる。
 */
export async function disableAnimations(): Promise<void> {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  await emulateReducedMotion("reduce");
}

/**
 * このテストの間だけ animation を戻す (ADR-0018)。閉じかけの popup が残る窓を検証するテストが
 * 本文の先頭で await する。次のテストの `beforeEach` が既定へ戻す (`parkMouse` と同じ形)。
 */
export async function enableAnimations(): Promise<void> {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
  await emulateReducedMotion("no-preference");
}
