/**
 * 実行中の CSS アニメーション (既定は document.body の子孫全て) の完了を待つ。
 *
 * ブラウザテストでも Tailwind が実 CSS に解決されるため (src/test/browser-setup.ts)、
 * base-ui の Dialog / Popover / Sheet に tw-animate-css の `data-open:animate-in` /
 * `data-closed:animate-out` が実際に効く。アニメーション中は transform で位置と
 * サイズが変わるので、次の 2 つの前に必ずこの helper を通す:
 *
 * - `getBoundingClientRect()` / `getComputedStyle()` によるレイアウトの実測
 * - `click({ force: true })` (Playwright の actionability を飛ばすため、要素が
 *   スライドイン途中で viewport 外にいると "Element is outside of the viewport" になる)
 *
 * Spinner 等の無限アニメーションは `finished` が解決しないため除外する
 * (待ち続けるとテストがタイムアウトするだけのため。ただし無限アニメーション要素
 * 自体の rect を測るテストでは transform が毎フレーム動くので別途配慮が要る)。
 */
export async function waitForAnimations(root: Element = document.body): Promise<void> {
  const pending = root.getAnimations({ subtree: true }).filter(hasFiniteDuration);
  await Promise.all(pending.map((animation) => animation.finished.catch(() => undefined)));
}

function hasFiniteDuration(animation: Animation): boolean {
  const endTime = animation.effect?.getComputedTiming().endTime;
  return typeof endTime === "number" && Number.isFinite(endTime);
}
