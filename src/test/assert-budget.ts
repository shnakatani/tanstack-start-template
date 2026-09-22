/**
 * ブラウザテストの assert が 1 件あたり待てる上限 (ADR-0029)。
 *
 * テストの予算 (`testTimeout`) とは別に持つ。Playwright が同じ分け方を公式に採り、
 * assertion 側の既定を 5000ms と文書化しているので、その値を写している。
 *
 * 消費者は `grep -rn ASSERT_TIMEOUT_MS src vitest.browser.config.ts` で出る。config の
 * 2 つの設定、mount を待つ helper、その helper の退行を見るテストの閾値が読む。
 * 値を動かすと最後のものも連動するので、変えたら `src/test/absent.test.tsx` を回す。
 */
export const ASSERT_TIMEOUT_MS = 5_000;
