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
 * assert と同じ予算を明示して渡す。失敗時は `Cannot find element with locator: <selector>`
 * が出る。この相互作用は上流に報告が無い (2026-09-22 に issue / PR を検索)。
 */
export function findElement(locator: Locator): Promise<HTMLElement | SVGElement> {
  return locator.findElement({ timeout: ASSERT_TIMEOUT_MS });
}
