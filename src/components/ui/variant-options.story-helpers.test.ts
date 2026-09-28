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
