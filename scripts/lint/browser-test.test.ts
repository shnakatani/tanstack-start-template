import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, expect, it } from "vite-plus/test";

import { preferLocatorMethods } from "./browser-test";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run("prefer-locator-methods", preferLocatorMethods, {
  valid: [
    // locator をそのまま渡す形
    'await expect.element(screen.getByRole("button")).toBeInTheDocument();',
    'await expect.element(row).toHaveAttribute("aria-busy", "true");',
    // retry を持つ口の中の同期読みは対象外
    "await expect.poll(() => rows.all().length).toBe(3);",
    'await expect.poll(() => el.element().textContent).toBe("x");',
    // locator に対応する matcher が無い実測
    "expect(el.element().getBoundingClientRect().width).toBeGreaterThan(0);",
    'expect(getComputedStyle(el.element()).opacity).toBe("0.5");',
    'expect(el.element().matches(":focus-visible")).toBe(true);',
    'expect(el.element().closest("label")).not.toBeNull();',
    // assert へ届かない同期読み
    "el.element().focus();",
    'const label = el.element().closest("label");',
  ],
  invalid: [
    {
      code: 'expect(screen.getByRole("button").query()).not.toBeNull();',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(rows.all()).toHaveLength(2);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(el.elements()).toHaveLength(2);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().getAttribute("aria-expanded")).toBe("true");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().textContent).toContain("x");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(document.activeElement).toBe(button.element());",
      errors: [{ messageId: "syncRead" }],
    },
    // 変数へ束縛してから渡す形。スコープ解析が外れるとここだけ無言で通る (ADR-0029)
    {
      code: "const el = locator.element(); expect(el).toBeTruthy();",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "const rows = locator.all(); expect(rows).toHaveLength(2);",
      errors: [{ messageId: "syncRead" }],
    },
    // 括弧と非 null アサーションで包んでも透かして見る
    {
      // 非 null アサーションは TypeScript の構文なので、parser へ .ts として渡す
      code: "expect((locator.query())!).not.toBeNull();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
  ],
});

describe("プラグインの形", () => {
  // `vite.config.ts` の `jsPlugins` の name と `lint.rules` のキーは、この 2 つの組で決まる。
  // どちらかを変えると設定側の名前が無言で解決されなくなる
  it("meta の name とルール名が oxlint の rules 設定と一致する", async () => {
    const plugin = (await import("./browser-test")).default;

    expect(plugin.meta?.name).toBe("browser-test");
    expect(Object.keys(plugin.rules)).toEqual(["prefer-locator-methods"]);
  });
});
