/**
 * ブラウザテストの assert が 1 件あたり待てる上限 (ADR-0029)。
 *
 * テストの予算 (`testTimeout`) とは別に持つ。Playwright が同じ分け方を公式に採り、
 * assertion 側の既定を 5000ms と文書化しているので、その値を写している。
 *
 * 消費者は `grep -rn ASSERT_TIMEOUT_MS src vitest.browser.config.ts` で出る。config が
 * `expect.poll.timeout` と `actionTimeout` に渡し、`find-element.ts` が `findElement` に
 * 渡す。後者は前者の副作用を補うためで、理由はそちらの docstring が持つ。
 */
export const ASSERT_TIMEOUT_MS = 5_000;
