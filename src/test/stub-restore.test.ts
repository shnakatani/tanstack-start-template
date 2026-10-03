import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

/**
 * `vi.stubEnv` / `vi.stubGlobal` で差し替えた値が、次のテストの前に戻ることを確かめる。
 * 戻らないと、後のテストが前のテストの差し替えの上で走り、順番で結果が変わっても気付けない
 * (`docs/guides/testing/mocking.md`「環境変数とグローバルを差し替える」)。
 *
 * `--no-isolate` でファイルをまたぐ値を塞ぐ setup の `afterEach` は、ここでは確かめない。
 * 確かめるには複数のファイルを決まった順で走らせる必要があり、同じ節の実測が根拠になる
 */
describe("テストの中の差し替え", () => {
  // 2 つのテストは書いた順に走る前提で組む (`.concurrent` を付けない。sequence.shuffle は既定で off)。
  // shuffle で 2 つ目が先に走ると、何も確かめずに通る
  it("差し替える", () => {
    vi.stubEnv("STUB_RESTORE_PROBE", "stubbed");
    vi.stubGlobal("__stubRestoreProbe", "stubbed");

    expect(process.env.STUB_RESTORE_PROBE).toBe("stubbed");
    expect(Reflect.get(globalThis, "__stubRestoreProbe")).toBe("stubbed");
  });

  it("次のテストでは差し替える前の値に戻っている", () => {
    expect(process.env.STUB_RESTORE_PROBE).toBeUndefined();
    expect(Reflect.has(globalThis, "__stubRestoreProbe")).toBe(false);
  });
});

// 設定の unstubEnvs / unstubGlobals が各テストの前に戻すので、beforeAll の差し替えは最初のテストに届かない。
// ガイドが差し替えを beforeEach かテストの中に限る前提を固定する
describe("beforeAll の差し替え", () => {
  beforeAll(() => {
    vi.stubEnv("STUB_RESTORE_BEFORE_ALL", "stubbed");
    vi.stubGlobal("__stubRestoreBeforeAll", "stubbed");
  });

  it("最初のテストの前に戻っている", () => {
    expect(process.env.STUB_RESTORE_BEFORE_ALL).toBeUndefined();
    expect(Reflect.has(globalThis, "__stubRestoreBeforeAll")).toBe(false);
  });
});
