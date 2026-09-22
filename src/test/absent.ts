import { expect } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";

/**
 * 要素が最初から無いことを検証する。**待たない。**
 *
 * `expect.element` の既定 timeout は `expect.poll.timeout` ではなくタスクの残り予算で、
 * `vitest.browser.config.ts` から設定できない。待って成立しない条件にその予算を渡すと、
 * 退行で赤になったとき 1 件でテストの所要を使い切る (ADR-0029)。
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
