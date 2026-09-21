import { describe, expect, test } from "vite-plus/test";

import { describeA11yNodes, describeA11yResults } from "./a11y-message";
import { a11yNode, a11yRule } from "./a11y.test-helpers";

describe("describeA11yNodes", () => {
  test("対象と failureSummary を並べる", () => {
    expect(
      describeA11yNodes([a11yNode({ target: ["#title"], summary: "背景を決められない" })]),
    ).toBe("    #title\n      背景を決められない");
  });

  test("failureSummary が無い node は空のまま出す", () => {
    expect(describeA11yNodes([a11yNode({ target: ["#title"] })])).toBe("    #title\n      ");
  });

  test("iframe 越しの target は空白でつなぐ", () => {
    expect(describeA11yNodes([a11yNode({ target: ["iframe", "#title"], summary: "x" })])).toContain(
      "    iframe #title",
    );
  });

  test("shadow root の境界は >> で見せる", () => {
    const nested = describeA11yNodes([a11yNode({ target: [["#host", "#shadow"]], summary: "x" })]);

    expect(nested).toContain("    #host >> #shadow");
  });

  test("node がゼロなら空文字", () => {
    expect(describeA11yNodes([])).toBe("");
  });
});

describe("describeA11yResults", () => {
  test("ルール名と help と対象と failureSummary を並べる", () => {
    const [line] = describeA11yResults([
      a11yRule("color-contrast", [a11yNode({ target: ["#title"], summary: "背景を決められない" })]),
    ]);

    expect(line).toContain("color-contrast");
    expect(line).toContain("color-contrast の説明");
    expect(line).toContain("#title");
    expect(line).toContain("背景を決められない");
  });

  test("impact は付いているときだけ出す", () => {
    const [withImpact] = describeA11yResults([a11yRule("color-contrast", [a11yNode()], "serious")]);
    const [withoutImpact] = describeA11yResults([a11yRule("color-contrast", [a11yNode()])]);

    expect(withImpact).toContain("color-contrast (serious):");
    expect(withoutImpact).toContain("color-contrast:");
    expect(withoutImpact).not.toContain("(");
  });
});
