import { expect } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";

/**
 * 要素が最初から無いことを検証する。**待たない。**
 *
 * 在る状態から消えるのを待つなら `expectRemoved` を使う。どちらも同じ matcher を呼び、
 * 違いは retry の予算だけなので、名前でどちらのつもりかを表明する (ADR-0043)。
 *
 * 待たないのは効率のためではなく、**落ちる向きを変えるため**である。予算を渡すと
 * 「いま在る」で落ちなくなり、この assert が持つ唯一の反証条件が消える。
 * `{ timeout: 0 }` を外す退行は `src/test/absent.test.tsx` の所要時間の閾値が捕まえる。
 *
 * この matcher は要素が無ければ 1 回目の試行で通る。**単独では何も検証していない**ので、
 * 同じ操作の効果を表す肯定 assert を先に置く。retry を持たない assert が flake を招くのは
 * Playwright が公式に警告している形で、その肯定 assert が緩和にあたる (ADR-0043)。
 */
export async function expectAbsent(target: Locator): Promise<void> {
  // oxlint-disable-next-line browser-test/no-bare-absence-assertion -- 不在確認の実体はここ
  await expect.element(target, { timeout: 0 }).not.toBeInTheDocument();
}

/**
 * 要素が在る状態から消えるのを待つ。**assert の予算ぶん待つ** (ADR-0042)。
 *
 * base-ui は `animate-out` の完了まで unmount を遅らせるため、消えるのを待つ側には retry の
 * 予算が要る (ADR-0040)。`expectAbsent` に置き換えると unmount を待たずに落ちる。
 *
 * 要素が最初から無くても通る。前段の操作がその要素を消すものであることは呼び出し側が
 * 担保する。ランタイムでは止められない理由は ADR-0043「不在の 2 つの意味は…」が持つ。
 */
export async function expectRemoved(target: Locator): Promise<void> {
  // oxlint-disable-next-line browser-test/no-bare-absence-assertion -- 消滅待ちの実体はここ
  await expect.element(target).not.toBeInTheDocument();
}
