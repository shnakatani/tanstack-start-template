import { describe, expect, it } from "vite-plus/test";

import { collectLoaderQueryKeys } from "./loader-helpers";

describe("collectLoaderQueryKeys", () => {
  it("各呼び出しの queryKey を JSON 文字列化して返す", () => {
    const calls: unknown[][] = [
      [{ queryKey: ["items", "2026-06-08"], queryFn: () => null }],
      [{ queryKey: ["users"], queryFn: () => null }],
    ];

    expect(collectLoaderQueryKeys(calls)).toEqual([
      JSON.stringify(["items", "2026-06-08"]),
      JSON.stringify(["users"]),
    ]);
  });

  it("呼び出しが無い場合は空配列を返す", () => {
    expect(collectLoaderQueryKeys([])).toEqual([]);
  });

  it("queryKey を持たない引数で呼ばれたら throw する (silent pass を防ぐ)", () => {
    expect(() => collectLoaderQueryKeys([[{ queryFn: () => null }]])).toThrow(/without a queryKey/);
  });

  it("第 1 引数が object でない場合も throw する", () => {
    expect(() => collectLoaderQueryKeys([[undefined]])).toThrow(/without a queryKey/);
    expect(() => collectLoaderQueryKeys([[null]])).toThrow(/without a queryKey/);
  });
});
