import { describe, expect, it } from "vite-plus/test";

import { variantOptions } from "./variant-options.story-helpers";

type Variant = "a" | "b";

describe("variantOptions", () => {
  it("渡した順にキーを返す", () => {
    expect(variantOptions({ a: null, b: null } satisfies Record<Variant, null>)).toEqual([
      "a",
      "b",
    ]);
  });

  it("キーが 1 つでも返す", () => {
    expect(variantOptions({ only: null } satisfies Record<"only", null>)).toEqual(["only"]);
  });
});

// 型のみの検証。vp test run では評価されず、落とすのは vp check の型検査である
describe("網羅の強制", () => {
  it("欠けたキーと余分なキーの両方が型エラーになる", () => {
    // @ts-expect-error 欠けたキー
    variantOptions({ a: null } satisfies Record<Variant, null>);
    // @ts-expect-error 余分なキー
    variantOptions({ a: null, b: null } satisfies Record<"a", null>);

    expect(true).toBe(true);
  });
});
