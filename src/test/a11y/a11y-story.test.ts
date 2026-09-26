import type { A11yTypes } from "@storybook/addon-a11y";
import { describe, expect, test } from "vite-plus/test";

import { checkA11yIncomplete, collectUnexpectedIncomplete } from "./a11y-story";
import { a11yNode as node, a11yRule as rule } from "./a11y.test-helpers";

/** `reporting.reports` の 1 件ぶん。`result` は `unknown` なので形は呼び出し側が決める */
function report(result: unknown) {
  return { type: "a11y", result };
}

/** `checkA11yIncomplete` へ渡す story context の最小形 */
function context(
  reports: { type: string; result: unknown }[],
  overrides: {
    parameters?: A11yTypes["parameters"];
    globals?: A11yTypes["globals"] & { ghostStories?: unknown };
  } = {},
) {
  return {
    reporting: { reports },
    parameters: overrides.parameters ?? {},
    globals: overrides.globals ?? {},
    viewMode: "story",
  };
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
        node({ messageKeys: ["controlsWithinPopup"], target: ["#trigger"] }),
        node({ messageKeys: ["noId"], target: ["#broken"] }),
      ]),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.nodes.map((n) => n.target)).toEqual([["#broken"]]);
  });

  test("外さないキーが同じ node に混ざっていれば落とさない", () => {
    const results = collectUnexpectedIncomplete([
      // 1 つの node には同じルールの複数の check が載る。2 つ目は除外リストに無いキーなら
      // 何でもよく、idrefs は aria-valid-attr-value と aria-errormessage のどちらも立てる
      rule("aria-valid-attr-value", [
        node({ messageKeys: ["controlsWithinPopup", "idrefs"], target: ["#both"] }),
      ]),
    ]);

    expect(results.map((r) => r.nodes.map((n) => n.target))).toEqual([[["#both"]]]);
  });

  test("node が 1 つも残らなかった結果は結果ごと落とす", () => {
    const results = collectUnexpectedIncomplete([
      rule("aria-valid-attr-value", [node({ messageKeys: ["controlsWithinPopup"] })]),
    ]);

    expect(results).toEqual([]);
  });
});

describe("checkA11yIncomplete", () => {
  const withIncomplete = report({
    incomplete: [rule("color-contrast", [node({ target: ["#title"] })])],
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
    const disabled = { parameters: { a11y: { disable: true } } };
    const testOff = { parameters: { a11y: { test: "off" } } } as const;

    expect(checkA11yIncomplete(context([withIncomplete], disabled))).toBeNull();
    expect(checkA11yIncomplete(context([withIncomplete], testOff))).toBeNull();
  });

  test('test: "todo" は addon が warning へ降ろす形なので見ない', () => {
    const todo = { parameters: { a11y: { test: "todo" } } } as const;

    expect(checkA11yIncomplete(context([withIncomplete], todo))).toBeNull();
  });

  test("ghostStories が立っていれば見ない", () => {
    // addon-vitest が globals へ入れる。addon はこのとき走らずレポートも積まれない
    const ghost = { globals: { ghostStories: { enabled: true } } };

    expect(checkA11yIncomplete(context([withIncomplete], ghost))).toBeNull();
  });

  test("addon パネルの manual を有効にしていれば見ない", () => {
    const manual = { globals: { a11y: { manual: true } } };

    expect(checkA11yIncomplete(context([withIncomplete], manual))).toBeNull();
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
