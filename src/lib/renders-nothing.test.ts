import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { rendersNothing } from "./renders-nothing";

describe("rendersNothing", () => {
  // `cond && <Badge />` の偽 (false) や、空の一覧の map (`[]`) で届く値
  it("React が何も描かない値なら true", () => {
    for (const node of [
      undefined,
      null,
      true,
      false,
      "",
      [],
      [null, false, ""],
      [[], [undefined]],
    ]) {
      expect(rendersNothing(node)).toBe(true);
    }
  });

  // 0 は `cond && x` の左辺に数を置いたときに描かれる "0" (react.dev の Conditional Rendering の Pitfall)
  it("描かれる値が 1 つでもあれば false", () => {
    for (const node of [
      "a",
      " ",
      0,
      createElement("span"),
      [null, "a"],
      [[], [createElement("span")]],
    ]) {
      expect(rendersNothing(node)).toBe(false);
    }
  });
});
