declare global {
  /**
   * Base UI の animation スイッチ。`true` の間、閉じた popup は animate-out の完了を待たずに
   * unmount する (`@base-ui/react/internals/useAnimationsFinished`)。型は Base UI 同梱の
   * `global.d.ts` と同じ宣言だが、`index.d.ts` から参照されず program に入らないため再宣言する。
   */
  // oxlint-disable-next-line no-var -- declare global の中で globalThis のプロパティになるのは var だけ
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

/** ブラウザテストの既定 (ADR-0018)。`src/test/browser-setup.tsx` の `beforeEach` が毎テスト呼ぶ。 */
export function disableBaseUiAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
}

/**
 * このテストの間だけ Base UI の animation を戻す (ADR-0018)。閉じかけの popup が残る窓を
 * 検証するテストが本文の先頭で呼ぶ。次のテストの `beforeEach` が既定へ戻す (`parkMouse` と同じ形)。
 */
export function enableBaseUiAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
}
