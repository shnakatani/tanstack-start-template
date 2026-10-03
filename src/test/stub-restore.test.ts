import { describe, expect, it, vi } from "vite-plus/test";

/**
 * テストの中で `vi.stubEnv` / `vi.stubGlobal` で差し替えた値が、次のテストの前に戻ることを確かめる。
 * 戻らないと、後のテストが前のテストの差し替えの上で走り、順番で結果が変わっても気付けない
 * (`docs/guides/testing/mocking.md`「環境変数とグローバルを差し替える」)。
 *
 * 2 つのテストは書いた順に走る前提で組む (`.concurrent` を付けない。sequence.shuffle は既定で off)
 */
describe("テストの間の差し替えの戻し", () => {
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
