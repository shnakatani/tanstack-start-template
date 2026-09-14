import { onTestFinished } from "vite-plus/test";

declare global {
  /**
   * Base UI の animation スイッチ。`true` の間、閉じた popup は animate-out の完了を待たずに
   * unmount する (`@base-ui/react/internals/useAnimationsFinished`)。型は Base UI 同梱の
   * `global.d.ts` と同じ宣言だが、`index.d.ts` から参照されず program に入らないため再宣言する。
   */
  // oxlint-disable-next-line no-var -- declare global の中で globalThis のプロパティになるのは var だけ
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

/**
 * 全ブラウザテストの既定 (ADR-0018)。`src/test/browser-setup.tsx` の `beforeEach` が毎テスト立て直す。
 * 閉じかけの popup が mount されたまま残る窓 (focus guard が focusable、行が aria-hidden 配下) を
 * 消し、検査がその窓に落ちるかどうかで結果が揺れないようにする。
 */
export function disableBaseUiAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
}

/**
 * このテストの間だけ Base UI の animation を戻す。close の animate-out の窓そのものを踏むテスト
 * (二重発火の dedupe など) が本文の先頭で呼ぶ。後続へ漏れないことは browser-setup.tsx の
 * `beforeEach` が保証し、`onTestFinished` は自テスト内の後始末 (Base UI 自身の
 * `ComboboxRoot.test.tsx` と同じ形)。
 */
export function enableBaseUiAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
  onTestFinished(disableBaseUiAnimations);
}
