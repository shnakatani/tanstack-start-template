/**
 * ブラウザテスト環境で Playwright の `.click()` を使えない要素へ native click を送る。
 *
 * base-ui の AlertDialog / Dialog では inert バックドロップが pointer events を
 * インターセプトする。また、`aria-disabled="true"` の button-role 要素は
 * Playwright の enabled 判定で actionability check がタイムアウトする一方、
 * 実 DOM の pointer-events は生きておりクリックできる。
 *
 * Checkbox はこの helper の対象ではない。`src/test/browser-setup.ts` が styles.css を読み
 * Tailwind が実 CSS に解決されるため 16x16 で描画され、本体・label テキストのどちらでも
 * Playwright の `.click()` が通る (2026-07-31 実測。いずれも onCheckedChange は 1 回)。
 * Checkbox に対する新規テストは `.click()` を使うこと。
 *
 * なお Checkbox 本体へ dispatchNativeClick を送ると、hidden input への転送が label の
 * activation behavior と重複して変更ハンドラが 2 回発火する (2026-07-31 実測)。やむを得ず
 * dispatch する場合は label テキスト要素側へ送って転送を 1 回にする。
 */
export function dispatchNativeClick(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}
