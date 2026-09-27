declare global {
  /**
   * Base UI の animation スイッチ。`true` の間、閉じた popup は animate-out の完了を待たずに
   * unmount する (`@base-ui/react/internals/useAnimationsFinished`)。型は Base UI 同梱の
   * `global.d.ts` と同じ宣言だが、`index.d.ts` から参照されず program に入らないため再宣言する。
   */
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

const DISABLE_ANIMATIONS_STYLE_ID = "test-disable-animations";

/**
 * テストにだけ注入する停止用の CSS。vitest.dev「Visual Regression Testing」の「Disable animations」の
 * snippet と同じ中身で、inline の指定にも勝つよう `!important` を付ける。
 */
const DISABLE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
`;

/**
 * ブラウザテストの既定 (docs/guides/testing/user-interactions.md「animation を無効にして走らせる理由」)。`src/test/browser/browser-setup.tsx` の `beforeEach` が毎テスト呼ぶ。
 * Base UI のスイッチ (上の宣言) を立て、停止用の CSS を `document.head` へ入れる。どちらも page
 * スコープで次のテストへ残るが、次の `beforeEach` が立て直すので戻す経路は持たない (`parkMouse` と同じ形)。
 */
export function disableAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  if (document.getElementById(DISABLE_ANIMATIONS_STYLE_ID) !== null) {
    return;
  }
  const style = document.createElement("style");
  style.id = DISABLE_ANIMATIONS_STYLE_ID;
  style.textContent = DISABLE_ANIMATIONS_CSS;
  document.head.append(style);
}

/**
 * このテストの間だけ animation を戻す (docs/guides/testing/user-interactions.md「animation を戻すテストを書く」)。閉じかけの popup が残る窓を検証するテストが
 * 本文の先頭で呼ぶ。次のテストの `beforeEach` が既定へ戻す。
 */
export function enableAnimations(): void {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
  document.getElementById(DISABLE_ANIMATIONS_STYLE_ID)?.remove();
}
