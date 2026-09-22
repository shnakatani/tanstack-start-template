import type { Locator } from "vite-plus/test/browser/context";

import { ASSERT_TIMEOUT_MS } from "./assert-budget";

/**
 * 操作の結果として現れる要素の生 DOM を、mount を待ってから取る (ADR-0013)。
 *
 * `locator.findElement()` を引数なしで呼ばない。公式の既定は「テストと同じ待ち時間」だが
 * (locators API の「By default, the timeout matches the test timeout」)、
 * `vitest.browser.config.ts` が `actionTimeout` を置くと **上限なし** になる。
 * vitest は actionTimeout が設定されていると呼び出し側の options をそのまま返し、
 * `findElement` の待機ループにはその場合の既定が無いため、要素が現れないと回り続けて
 * `Test timed out` になり locator の名前が出力から消える (2026-09-22 実測)。
 *
 * 公式の既定 (テストの予算) を復元するのではなく、assert の予算を代わりに置く。要素が現れる
 * のを待つ点で肯定 assert と同じ種類の待機だからで、予算が 2 つに割れているほうが読めない。
 * 失敗時は `Cannot find element with locator: <selector>` が出る。この相互作用は上流に
 * 報告が無い (2026-09-22 に issue / PR を検索)。
 *
 * `strict` 等の option は受けない。呼び出し側から timeout を上書きできる口を開けると、
 * `{ timeout: undefined }` で上限なしへ戻せてしまう。必要になったらこの helper を広げる。
 * 素の呼び出しは `browser-test/no-bare-find-element` が止めるので、迂回はできない。
 */
export function findElement(locator: Locator): Promise<HTMLElement | SVGElement> {
  return locator.findElement({ timeout: ASSERT_TIMEOUT_MS });
}
