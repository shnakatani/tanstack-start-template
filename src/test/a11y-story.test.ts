import type axe from "axe-core";
import { describe, expect, test } from "vite-plus/test";

import {
  checkA11yIncomplete,
  collectUnexpectedIncomplete,
  describeA11yResults,
} from "./a11y-story";

function check(messageKey?: string): axe.CheckResult {
  return {
    id: "color-contrast",
    impact: "serious",
    message: "",
    data: messageKey === undefined ? null : { messageKey },
    relatedNodes: [],
  };
}

function node(
  options: { messageKey?: string; target?: string; summary?: string } = {},
): axe.NodeResult {
  return {
    html: "<p></p>",
    target: [options.target ?? "p"],
    any: [check(options.messageKey)],
    all: [],
    none: [],
    failureSummary: options.summary,
  };
}

function rule(id: string, nodes: axe.NodeResult[]): axe.Result {
  return { description: "", help: `${id} の説明`, helpUrl: "", id, tags: [], nodes };
}

/** `reporting.reports` の 1 件ぶん。`result` は `unknown` なので形は呼び出し側が決める */
function report(result: unknown) {
  return { type: "a11y", result };
}

/** `checkA11yIncomplete` へ渡す story context の最小形 */
function context(reports: { type: string; result: unknown }[], parameters: unknown = {}) {
  return { reporting: { reports }, parameters, viewMode: "story" };
}

describe("collectUnexpectedIncomplete", () => {
  test("除外に当たらないルールはそのまま残す", () => {
    const results = collectUnexpectedIncomplete([rule("color-contrast", [node()])]);

    expect(results.map((r) => r.id)).toEqual(["color-contrast"]);
  });

  test("ルールごと外すものは messageKey が無くても落とす", () => {
    const results = collectUnexpectedIncomplete([rule("aria-hidden-focus", [node()])]);

    expect(results).toEqual([]);
  });

  test("messageKey で外すものは、同じルールの別の messageKey を残す", () => {
    const results = collectUnexpectedIncomplete([
      rule("aria-valid-attr-value", [
        node({ messageKey: "controlsWithinPopup", target: "#trigger" }),
        node({ messageKey: "noId", target: "#broken" }),
      ]),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.nodes.map((n) => n.target)).toEqual([["#broken"]]);
  });

  test("node が 1 つも残らなかった結果は結果ごと落とす", () => {
    const results = collectUnexpectedIncomplete([
      rule("aria-valid-attr-value", [node({ messageKey: "controlsWithinPopup" })]),
    ]);

    expect(results).toEqual([]);
  });
});

describe("describeA11yResults", () => {
  test("ルール名と help と対象と failureSummary を並べる", () => {
    const [line] = describeA11yResults([
      rule("color-contrast", [node({ target: "#title", summary: "背景を決められない" })]),
    ]);

    expect(line).toContain("color-contrast");
    expect(line).toContain("color-contrast の説明");
    expect(line).toContain("#title");
    expect(line).toContain("背景を決められない");
  });
});

describe("checkA11yIncomplete", () => {
  const withIncomplete = report({
    incomplete: [rule("color-contrast", [node({ target: "#title" })])],
  });

  test("判定へ入れる incomplete が無ければ null", () => {
    expect(checkA11yIncomplete(context([report({ incomplete: [] })]))).toBeNull();
  });

  test("判定へ入れる incomplete を文言にして返す", () => {
    const message = checkA11yIncomplete(context([withIncomplete]));

    expect(message).toContain("color-contrast");
    expect(message).toContain("#title");
  });

  test("story が a11y を切っていれば見ない", () => {
    expect(checkA11yIncomplete(context([withIncomplete], { a11y: { disable: true } }))).toBeNull();
    expect(checkA11yIncomplete(context([withIncomplete], { a11y: { test: "off" } }))).toBeNull();
  });

  test("docs 表示では見ない。addon が走らずレポートが積まれない", () => {
    expect(checkA11yIncomplete({ ...context([]), viewMode: "docs" })).toBeNull();
  });

  test("addon が失敗を積んでいれば重ねて落とさない", () => {
    expect(checkA11yIncomplete(context([report({ error: new Error("走らなかった") })]))).toBeNull();
  });

  test("レポートが無ければ落とす", () => {
    const message = checkA11yIncomplete(context([{ type: "interactions", result: {} }]));

    expect(message).toContain("レポートが無い");
  });

  test("レポートの形が読めなければ落とす", () => {
    const message = checkA11yIncomplete(context([report({ incomplete: "配列ではない" })]));

    expect(message).toContain("読めない");
  });
});
