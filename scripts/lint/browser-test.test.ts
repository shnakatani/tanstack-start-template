import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, expect, it } from "vite-plus/test";

import browserTestPlugin, {
  noBareAbsenceAssertion,
  noFindElement,
  noNegatedStyleLiteral,
  preferLocatorMethods,
} from "./browser-test";

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
    // 束縛して matcher の期待値に使う形は、観測の基準値との比較 (docs/guides/testing.md「否定を肯定で書く」)
    "const before = getComputedStyle(a.element()).color; await expect.poll(() => getComputedStyle(a.element()).color).toBe(before);",
    'const before = a.element().getAttribute("a"); await expect.element(b).toHaveAttribute("a", before);',
    "const before = a.element().textContent; expect(y).toBe(before);",
    // assert へ届かない同期読み
    "el.element().focus();",
    'const label = el.element().closest("label");',
    // `vi.waitFor` も retry の口 (docs/guides/testing.md「待つ口を選ぶ」)。assert へ直に届く形をここで固定する
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
    // matcher の無い実測も expect.poll の中で読む。直接流す形を許す列挙は 2026-09-22 に撤去した
    {
      code: "expect(el.element().getBoundingClientRect().width).toBeGreaterThan(0);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().matches(":focus-visible")).toBe(true);',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().closest("label")).not.toBeNull();',
      errors: [{ messageId: "syncRead" }],
    },
    // 同期読み由来の値は、関数の引数・演算・テンプレート・リテラル・await を通っても retry されない
    {
      code: 'expect(getComputedStyle(el.element()).opacity).toBe("0.5");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(Number(el.element().getAttribute("a"))).toBe(1);',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(`${el.element().textContent}`).toBe("a");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(!el.query()).toBe(true);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect([el.element()]).toHaveLength(1);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect({ el: el.element() }).toBeTruthy();",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(await el.element()).toBeTruthy();",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // 束縛の右辺が連鎖でも、先頭の同期読みから参照を辿る
      code: 'const expanded = el.element().getAttribute("aria-expanded"); expect(expanded).toBe("true");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      // 要素そのものの束縛は、matcher の期待値に来ても基準値ではない (ADR-0054)
      code: "const el = locator.element(); expect(document.activeElement).toBe(el);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "const els = locator.all(); expect(found).toEqual(els);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // 包む節点 (`!` / `as` / `await`) を挟んでも要素の束縛。`!` は TS なので filename で TS として解析させる
      code: "const el = locator.query()!; expect(document.activeElement).toBe(el);",
      filename: "case.test.ts",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "const el = await locator.element(); expect(document.activeElement).toBe(el);",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // 連鎖の束縛が assert の主語 (第 1 引数) に来る形
      code: 'const t = el.element().textContent; assert.equal(t, "a");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      // vite-plus/test の assert も assert の口
      code: 'assert.equal(el.element().textContent, "a");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(new Set(el.elements()).size).toBe(1);",
      errors: [{ messageId: "syncRead" }],
    },
    // 変数へ束縛してから渡す形。スコープ解析が外れるとここだけ無言で通る (ADR-0054)
    {
      code: "const el = locator.element(); expect(el).toBeTruthy();",
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "const rows = locator.all(); expect(rows).toHaveLength(2);",
      errors: [{ messageId: "syncRead" }],
    },
    // 値を包むだけの節点は透かして見る。`filename` を .ts にするのは TypeScript の構文を
    // 含むケースだけ (RuleTester の既定は file.js)
    {
      code: "expect((locator.query())!).not.toBeNull();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
    // 値を素通しする節点を挟んだ形。塞がないと構文 1 種がまるごと素通りする
    {
      code: 'expect(el.query()?.textContent).toBe("x");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(rows[1]?.element().textContent).toContain("x");',
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: "expect(el.query() ? 1 : 2).toBe(1);",
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
      errors: [{ messageId: "syncRead" }],
    },
    {
      code: 'expect(el.element().getAttribute("a") ?? "").toBe("b");',
      errors: [{ messageId: "syncRead" }],
    },
    // `expect.element` が retry するのは locator を渡したときだけ。同期読みを渡すと
    // 最初に解決した要素を retry し続ける
    {
      code: "expect.element(locator.element()).toBeInTheDocument();",
      errors: [{ messageId: "syncRead" }],
    },
    {
      // matcher の引数は 1 度しか評価されない
      code: 'expect.element(a).toHaveAttribute("x", b.element());',
      errors: [{ messageId: "syncRead" }],
    },
    {
      // このリポジトリは `as` を禁じている (ADR-0012) が、抑制付きで入ったときに
      // 透かせないと報告が無言で消える。WRAPPER_TYPES の TSAsExpression を守る
      code: "expect(locator.query() as Element).not.toBeNull();",
      filename: "a.ts",
      errors: [{ messageId: "syncRead" }],
    },
  ],
});

tester.run("no-find-element", noFindElement, {
  valid: [
    // mount 待ちは builtin の matcher。retry と予算を vitest が持つ
    'await expect.element(screen.getByRole("dialog")).toBeInTheDocument();',
  ],
  invalid: [
    {
      code: 'await screen.getByRole("dialog").findElement();',
      errors: [{ messageId: "findElement" }],
    },
    {
      // timeout を明示しても呼ばない。予算を呼び出しごとに持つ形は 2026-09-22 に撤去した (ADR-0054)
      code: "await locator.findElement({ timeout: 5000 });",
      errors: [{ messageId: "findElement" }],
    },
  ],
});

tester.run("no-negated-style-literal", noNegatedStyleLiteral, {
  valid: [
    // 観測どうしの比較。期待値が式なので綴りで潰れない
    "expect(getComputedStyle(a).color).not.toBe(colorBefore);",
    "expect(getComputedStyle(a).color).not.toBe(getComputedStyle(b).color);",
    "await expect.poll(() => getComputedStyle(a).color).not.toBe(before);",
    // 肯定形はリテラルでも fail-closed
    'await expect.element(x).toHaveStyle("outline-width: 0px");',
    'expect(getComputedStyle(a).outlineWidth).toBe("0px");',
    // スタイル以外の否定は対象外
    'await expect.element(x).not.toHaveAttribute("aria-busy", "true");',
    // 束縛した算出値が matcher の期待値側に来る形。主語はリテラルではない
    "const before = getComputedStyle(a).color; expect(getComputedStyle(a).color).not.toBe(before);",
    // 束縛しても、比較の相手が別の観測なら対象外
    "const shown = getComputedStyle(a); expect(shown.color).not.toBe(hidden.color);",
    // 式を含むテンプレートリテラルは観測どうしの比較。綴りで潰れない
    "expect(getComputedStyle(a).width).not.toBe(`${before}px`);",
    // 識別子を含む配列は観測の比較
    "expect(getComputedStyle(a).color).not.toStrictEqual([before]);",
    // docs/guides/testing.md「否定を肯定で書く」が推奨する肯定形。src/components/ui/dialog.test.tsx の綴り
    "await expect.poll(() => Number.parseFloat(getComputedStyle(x).maxHeight)).toBeGreaterThan(0);",
    // 同じく肯定形。src/components/parts/segmented-radio-group.test.tsx の綴り
    `await expect
       .poll(() => {
         const style = getComputedStyle(focused);
         return style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
       })
       .toBeGreaterThan(0);`,
    // 算出値を読むだけで assert へ流さない
    "const style = getComputedStyle(x); if (style.display === none) { run(); }",
  ],
  invalid: [
    {
      // 解釈できない宣言で素通りする
      code: 'await expect.element(x).not.toHaveStyle("outline-width: 0");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 正しい宣言でも、綴りが 1 つ外れた時点で素通りする側に落ちる
      code: 'await expect.element(x).not.toHaveStyle("pointer-events: none");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 算出値は "0px" なので単位を落とすと潰れた状態でも通る
      code: 'await expect.poll(() => getComputedStyle(x).outlineWidth).not.toBe("0");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      code: 'expect(getComputedStyle(x).maxHeight).not.toBe("none");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 値に式を埋めても宣言名は字面。綴り違い (`colr:`) は解釈できない宣言になり `.not` が真になる
      code: "await expect.element(x).not.toHaveStyle(`color: ${token}`);",
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 負数と配列リテラルも字面
      code: "expect(Number(getComputedStyle(x).opacity)).not.toBe(-1);",
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      code: 'expect(getComputedStyle(x).color).not.toStrictEqual(["a"]);',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 変数へ束縛してから読む形。`dialog-scroll-body.test.tsx` が踏んでいた綴り
      code: 'const shown = getComputedStyle(x); expect(shown.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // プロパティまで読んでから束縛する形
      code: 'const width = getComputedStyle(x).outlineWidth; expect(width).not.toBe("0");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // コールバックがブロック本体。簡潔本体だけを透かすと見逃す
      code: 'await expect.poll(() => { return getComputedStyle(x).outlineWidth; }).not.toBe("0");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // function 式のコールバック
      code: 'await expect.poll(function () { return getComputedStyle(x).outlineWidth; }).not.toBe("0");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // docs/guides/testing.md「否定を肯定で書く」が推奨する肯定形を否定へ倒した退行。src の 8 箇所がこの綴り
      code: "await expect.poll(() => Number.parseFloat(getComputedStyle(x).maxHeight)).not.toBe(0);",
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // Number で包む形
      code: "expect(Number(getComputedStyle(off).opacity)).not.toBe(1);",
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 束縛・三項・数値化・ブロック本体が重なる形 (segmented-radio-group.test.tsx の骨格)
      code: `await expect
         .poll(() => {
           const style = getComputedStyle(focused);
           return style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
         })
         .not.toBe(0);`,
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // expect.soft も assert の主語を取る
      code: 'expect.soft(getComputedStyle(x).color).not.toBe("red");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // オブジェクト形式。否定と組むと同じく素通りする
      code: 'await expect.element(x).not.toHaveStyle({ maxHeight: "none" });',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 同じ束縛を 2 つの引数で読む形。報告は matcher 1 つにつき 1 件
      code: 'const c = getComputedStyle(x); expect(c.color, c.width).not.toBe("a");',
      errors: [{ messageId: "negatedStyleLiteral" }],
    },
    {
      // 1 つの束縛から別々の matcher へ届く形。畳まずに両方を報告する
      code: 'const c = getComputedStyle(x); expect(c.color).not.toBe("a"); expect(c.width).not.toBe("b");',
      errors: [{ messageId: "negatedStyleLiteral" }, { messageId: "negatedStyleLiteral" }],
    },
  ],
});

tester.run("no-bare-absence-assertion", noBareAbsenceAssertion, {
  valid: [
    // 2 つの helper が唯一の正当な呼び出し元。呼び出し側は名前でどちらかを表明する
    "await expectAbsent(screen.getByText('x'));",
    "await expectRemoved(screen.getByText('x'));",
    // 肯定形と、ほかの否定 matcher は対象外
    "await expect.element(x).toBeInTheDocument();",
    'await expect.element(x).not.toHaveAttribute("aria-busy", "true");',
    // Testing Library の query は locator ではない。story の play が使う形
    "await expect(screen.queryByRole('dialog')).not.toBeInTheDocument();",
  ],
  invalid: [
    {
      // 素で書くと「最初から無い」と「消えるのを待つ」が字面で区別できない
      code: "await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();",
      errors: [{ messageId: "bareAbsence" }],
    },
    {
      // timeout を直に渡す形も同じ
      code: "await expect.element(x, { timeout: 0 }).not.toBeInTheDocument();",
      errors: [{ messageId: "bareAbsence" }],
    },
  ],
});

describe("プラグインの形", () => {
  // `vite.config.ts` の `jsPlugins` の name と `lint.rules` のキーは、この 2 つの組で決まる。
  // どちらかを変えると設定側の名前が無言で解決されなくなる
  it("meta の name とルール名が oxlint の rules 設定と一致する", () => {
    const plugin = browserTestPlugin;

    expect(plugin.meta?.name).toBe("browser-test");
    expect(Object.keys(plugin.rules)).toEqual([
      "prefer-locator-methods",
      "no-find-element",
      "no-negated-style-literal",
      "no-bare-absence-assertion",
    ]);
  });
});
