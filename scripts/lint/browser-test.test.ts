import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, expect, it } from "vite-plus/test";

import { noBareFindElement, preferLocatorMethods } from "./browser-test";

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
    // `expect.poll` の引数はコールバックごと retry される
    'await expect.poll(() => el.element().textContent).toBe("x");',
    // locator に対応する matcher が無い実測
    "expect(el.element().getBoundingClientRect().width).toBeGreaterThan(0);",
    'expect(getComputedStyle(el.element()).opacity).toBe("0.5");',
    'expect(el.element().matches(":focus-visible")).toBe(true);',
    'expect(el.element().closest("label")).not.toBeNull();',
    // assert へ届かない同期読み
    "el.element().focus();",
    'const label = el.element().closest("label");',
    // `vi.waitFor` も retry の口 (ADR-0013)。assert へ直に届く形をここで固定する
    'vi.waitFor(() => { expect(el.element().textContent).toBe("x"); });',
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
    // 値を包むだけの節点は透かして見る。TypeScript の構文なので parser へ .ts として渡す
    {
      code: "expect((locator.query())!).not.toBeNull();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    // 値を素通しする節点を挟んだ形。塞がないと構文 1 種がまるごと素通りする
    {
      code: 'expect(el.query()?.textContent).toBe("x");',
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(rows[1]?.element().textContent).toContain("x");',
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(el.query() ? 1 : 2).toBe(1);",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(el.element() satisfies Element).toBe(1);",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // `expect.poll` が retry するのはコールバックだけ。matcher の引数は 1 度きり
      code: "await expect.poll(() => 1).toBe(b.element());",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().getAttribute("a") ?? "").toBe("b");',
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    // `expect.element` が retry するのは locator を渡したときだけ。同期読みを渡すと
    // 最初に解決した要素を retry し続ける
    {
      code: "expect.element(locator.element()).toBeInTheDocument();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // matcher の引数は 1 度しか評価されない
      code: 'expect.element(a).toHaveAttribute("x", b.element());',
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // このリポジトリは `as` を禁じている (typing.md) が、抑制付きで入ったときに
      // 透かせないと報告が無言で消える。WRAPPER_TYPES の TSAsExpression を守る
      code: "expect(locator.query() as Element).not.toBeNull();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
  ],
});

tester.run("no-bare-find-element", noBareFindElement, {
  valid: [
    // helper 経由なら対象外。名前が同じでも member 呼び出しではない
    'await findElement(screen.getByRole("dialog"));',
    // 呼び出し元の除外は config の `excludeFiles` が持つ。ルールは filename を見ない
    "findElement({ a: 1 });",
  ],
  invalid: [
    {
      code: 'await screen.getByRole("dialog").findElement();',
      errors: [{ messageId: "bareFindElement" }],
    },
    {
      // options を渡しても素の呼び出しは対象。timeout を書き忘れる形が主な事故
      code: "await locator.findElement({ strict: false });",
      errors: [{ messageId: "bareFindElement" }],
    },
    {
      // helper 自身のパスでも報告する。除外は config が持ち、ルールは場所を知らない
      code: "await locator.findElement({ timeout: 5000 });",
      filename: "src/test/find-element.ts",
      errors: [{ messageId: "bareFindElement" }],
    },
  ],
});

describe("プラグインの形", () => {
  // `vite.config.ts` の `jsPlugins` の name と `lint.rules` のキーは、この 2 つの組で決まる。
  // どちらかを変えると設定側の名前が無言で解決されなくなる
  it("meta の name とルール名が oxlint の rules 設定と一致する", async () => {
    const plugin = (await import("./browser-test")).default;

    expect(plugin.meta?.name).toBe("browser-test");
    expect(Object.keys(plugin.rules)).toEqual(["prefer-locator-methods", "no-bare-find-element"]);
  });
});
