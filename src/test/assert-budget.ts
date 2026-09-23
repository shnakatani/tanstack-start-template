/**
 * ブラウザテストの assert が 1 件あたり待てる上限。
 *
 * テストの予算 (`testTimeout`) とは別に持つ。Playwright が同じ分け方を公式に採り、
 * assertion 側の既定を 5000ms と文書化しているので、その値を写している。
 *
 * 上げると Playwright の操作 (`click` / `fill` など) の上限も一緒に上がる。config が
 * `actionTimeout` にも同じ値を渡しており、そちらは操作にしか効かないためである。
 * `actionTimeout` を置かないと `expect.element` が `expect.poll.timeout` を読まない (vitest-dev/vitest#8308
 * が OPEN。メンテナは #9157 で両方を置く形を示している)。
 *
 * 消費者は `grep -rn ASSERT_TIMEOUT_MS src vitest.browser.config.ts` で出る。config の
 * 2 つの設定のほか、`absent.test.tsx` が退行を見る閾値とテスト自身の timeout に使う。
 * **値を動かしたらそれを回す。** 比で書いてあるので追随するが、追随した先が妥当かは実測で確かめる。
 */
export const ASSERT_TIMEOUT_MS = 5_000;
