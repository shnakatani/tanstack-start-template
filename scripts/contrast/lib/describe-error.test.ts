import { describe, expect, it } from "vite-plus/test";

import { describeError } from "./describe-error";

describe("describeError", () => {
  it("cause を辿って連鎖にする", () => {
    const deep = new Error("いちばん奥");
    const middle = new Error("途中", { cause: deep });
    expect(describeError(new Error("入口", { cause: middle }))).toBe("入口 ← 途中 ← いちばん奥");
  });

  it("Error でないものは String へ落とす", () => {
    // throw されるのは Error とは限らない。落とさないと "[object Object]" すら出ない
    expect(describeError("ただの文字列")).toBe("ただの文字列");
    expect(describeError(undefined)).toBe("undefined");
  });

  it("cause が循環しても止まる", () => {
    // 10 段で切らないと、循環した cause で無限に回って出力が出ない
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    expect(describeError(a).split(" ← ")).toHaveLength(10);
  });

  it("cause が Error でなければそこで止める", () => {
    // 文字列の cause を messages へ足すと、Error の message と区別が付かなくなる
    expect(describeError(new Error("入口", { cause: "ただの文字列" }))).toBe("入口");
  });
});
