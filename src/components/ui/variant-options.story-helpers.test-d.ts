import { describe, expectTypeOf, it } from "vite-plus/test";

import type { variantOptions } from "./variant-options.story-helpers";

// 型引数で受けない判断 (variantOptions の docstring) を固定する。`.parameter(0)` は generic の
// 型引数を制約へ置き換えて通るので、関数の型全体を突き合わせる。
// 落とすのは `vp check` の type-aware lint で、`vp test run` はこのファイルを集めない
describe("variantOptions の型", () => {
  it("型引数を持たない", () => {
    expectTypeOf<typeof variantOptions>().toEqualTypeOf<
      (members: Record<string, null>) => string[]
    >();
  });
});
