import { expect } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";

/**
 * 要素が最初から無いことを検証する。**待たない。**
 *
 * assert の予算は `vitest.browser.config.ts` が `expect.poll.timeout` で宣言している
 * (ADR-0030)。待って成立しない条件にその予算を渡しても無駄に待つだけなので、ここは
 * `{ timeout: 0 }` で打ち切る。
 *
 * この matcher は要素が無ければ 1 回目の試行で通る。**単独では何も検証していない**ので、
 * 同じ操作の効果を表す肯定 assert を先に置く。
 *
 * 要素が在る状態から消えるのを待つときは使わない。base-ui は `animate-out` の完了まで
 * unmount を遅らせるため retry の予算が要る (ADR-0018)。そちらは
 * `expect.element(locator).not.toBeInTheDocument()` をそのまま書く。呼び出し側の名前で
 * どちらのつもりかが読める。
 */
export async function expectAbsent(target: Locator): Promise<void> {
  await expect.element(target, { timeout: 0 }).not.toBeInTheDocument();
}
