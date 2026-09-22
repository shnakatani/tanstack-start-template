import { expect } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";

/**
 * 要素が「見つからない」ことの検証を 2 つに分ける (ADR-0031)。
 *
 * どちらも同じ matcher (`not.toBeInTheDocument()`) を呼ぶ。違うのは retry の予算だけで、
 * 字面では読み分けられない。名前を分けることで、呼び出し側でどちらのつもりかが読める。
 *
 * | 場面                 | 使うもの                   | 予算                       |
 * | -------------------- | -------------------------- | -------------------------- |
 * | 最初から出ない       | `expectAbsent(locator)`    | 待たない (`{ timeout: 0 }`) |
 * | 在る状態から消える   | `expectRemoved(locator)`   | assert の予算 (ADR-0030)   |
 *
 * 上流の対応物である `@testing-library/dom` の `waitForElementToBeRemoved` は、要素が
 * 最初から無いときに throw して取り違えをランタイムで止める。**この保証は移植できない。**
 * 公式 API は操作の前に捕まえた要素を受け取る設計で、操作の後に assert を書く形では
 * 正当な消滅待ちでも `already removed` で落ちる (2026-09-22 に実測)。
 * ここで買えるのは読みやすさと、素の呼び出しを lint で止められることだけである。
 */

/**
 * 要素が最初から無いことを検証する。**待たない。**
 *
 * assert の予算は `vitest.browser.config.ts` が `expect.poll.timeout` で宣言している
 * (ADR-0030)。待って成立しない条件にその予算を渡しても無駄に待つだけなので、ここは
 * `{ timeout: 0 }` で打ち切る。
 *
 * この matcher は要素が無ければ 1 回目の試行で通る。**単独では何も検証していない**ので、
 * 同じ操作の効果を表す肯定 assert を先に置く。retry を持たない assert が flake を招くのは
 * Playwright が公式に警告している形で、その肯定 assert が緩和にあたる (ADR-0031)。
 */
export async function expectAbsent(target: Locator): Promise<void> {
  // oxlint-disable-next-line browser-test/no-bare-absence-assertion -- 不在確認の実体はここ
  await expect.element(target, { timeout: 0 }).not.toBeInTheDocument();
}

/**
 * 要素が在る状態から消えるのを待つ。**assert の予算ぶん待つ。**
 *
 * base-ui は `animate-out` の完了まで unmount を遅らせるため、消えるのを待つ側には retry の
 * 予算が要る (ADR-0018)。`expectAbsent` に置き換えると unmount を待たずに落ちる。
 *
 * 要素が最初から無くても通る。前段の操作がその要素を消すものであることは、呼び出し側が
 * 担保する (上の docstring のとおり、ランタイムでは止められない)。
 */
export async function expectRemoved(target: Locator): Promise<void> {
  // oxlint-disable-next-line browser-test/no-bare-absence-assertion -- 消滅待ちの実体はここ
  await expect.element(target).not.toBeInTheDocument();
}
