import type axe from "axe-core";
import { describe, expect, test } from "vite-plus/test";

import { describeA11yNodes } from "./a11y-message";

function node(options: { target?: string[]; summary?: string } = {}): axe.NodeResult {
  return {
    html: "<p></p>",
    target: options.target ?? ["p"],
    any: [],
    all: [],
    none: [],
    failureSummary: options.summary,
  };
}

describe("describeA11yNodes", () => {
  test("対象と failureSummary を並べる", () => {
    expect(describeA11yNodes([node({ target: ["#title"], summary: "背景を決められない" })])).toBe(
      "    #title\n      背景を決められない",
    );
  });

  test("failureSummary が無い node は空のまま出す", () => {
    expect(describeA11yNodes([node({ target: ["#title"] })])).toBe("    #title\n      ");
  });

  test("iframe 越しの target は空白でつなぐ", () => {
    expect(describeA11yNodes([node({ target: ["iframe", "#title"], summary: "x" })])).toContain(
      "    iframe #title",
    );
  });

  test("node がゼロなら空文字", () => {
    expect(describeA11yNodes([])).toBe("");
  });
});
