import { afterEach, vi } from "vite-plus/test";

/**
 * 全 project のテストの後に `vi.stubEnv` と `vi.stubGlobal` の値を戻す。設定の `unstubEnvs` と `unstubGlobals` は
 * 次のテストの前に戻すので、`--no-isolate` ではファイルの最後のテストの値が次のファイルのモジュール評価と
 * `beforeAll` に見える (`docs/guides/testing/mocking.md`「差し替えの戻しを設定と setup の両方に置く理由」)
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
