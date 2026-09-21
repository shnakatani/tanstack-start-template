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
    expect(describeError(a).split(" ← ")).toHaveLength(11);
    expect(describeError(a)).toContain("(以下略)");
  });

  it("切ったことを出力へ出す", () => {
    // 落ちるのは最奥 = 根本原因の側。印が無いと 10 段ちょうどと見分けが付かず、
    // いちばん知りたい行が消えたことに気づけない
    const chain = (depth: number) => {
      let error = new Error(`e${depth}`);
      for (let level = depth - 1; level >= 1; level -= 1) {
        error = new Error(`e${level}`, { cause: error });
      }
      return error;
    };
    expect(describeError(chain(10))).not.toContain("(以下略)");
    expect(describeError(chain(11))).toContain("(以下略)");
    expect(describeError(chain(11))).not.toContain("e11");
  });

  it("cause が Error でなければそこで止める", () => {
    // 文字列の cause を messages へ足すと、Error の message と区別が付かなくなる
    expect(describeError(new Error("入口", { cause: "ただの文字列" }))).toBe("入口");
  });
});
