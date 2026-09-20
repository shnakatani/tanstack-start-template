/** この関数が root に求めるもの。`Element` はこれを満たす */
export interface RootElement {
  matches(selectors: string): boolean;
  readonly ownerDocument: Document;
}

/** この関数が stylesheet に求めるもの。`CSSStyleSheet` はこれを満たす */
export interface ReadableStyleSheet {
  readonly href: string | null;
  readonly cssRules: CSSRuleList;
}

/**
 * `<html>` に当たる rule が宣言しているカスタムプロパティを名前順で集める。
 *
 * Tailwind v4 は `@theme` の内容を `@layer theme { :root, :host { ... } }` へ出すため、
 * トップレベルの `CSSStyleRule` だけでなく `@layer` / `@media` 等のグループ規則
 * (`CSSGroupingRule` を継承する rule 全般) の中も再帰的に辿る。辿らないと `@layer` の中の
 * 宣言を見落とす (ADR-0022)。
 *
 * 対象の判定は `Element.matches()` に委ねる。`selectorText` を `,` で分けて `:root` と
 * 比べる形にすると、`:is(:root, .x)` のように `,` を内側に持つ selector を取りこぼす。
 *
 * ただし root に当たるだけでは足りない。Tailwind の `*, ::before, ::after, ::backdrop` は
 * root にも当たり、内部用の変数を持ち込む。任意の要素にも当たる rule は root 固有では
 * ないので除く。混入の有無は Storybook で `Tokens/Colors` を開き、`--tw` で始まる名前が
 * 並んでいないかで見る。
 */
export function collectRootCustomProperties(
  sheets: Iterable<ReadableStyleSheet>,
  prefix: string,
  root: RootElement,
): string[] {
  const names = new Set<string>();
  // 「任意の要素にも当たるか」を測る相手。document へ挿さないので他の rule の影響を受けない
  const anyElement = root.ownerDocument.createElement("div");

  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && isRootScoped(root, anyElement, rule.selectorText)) {
        for (const name of rule.style) {
          if (name.startsWith(prefix)) names.add(name);
        }
      }
      if (rule instanceof CSSGroupingRule) visit(rule.cssRules);
    }
  };

  for (const sheet of sheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // 別オリジンの stylesheet は cssRules を読めない。Storybook の preview では起きないが、
      // 読めないものを黙って飛ばすと一覧が欠けるので残す
      console.warn("[css-rules] cssRules を読めない stylesheet", { href: sheet.href });
    }
  }

  return [...names].sort();
}

/** `matches()` は不正な selector で例外を投げる。走査を止めずにその rule だけ飛ばす */
function isRootScoped(root: RootElement, anyElement: Element, selectorText: string): boolean {
  try {
    return root.matches(selectorText) && !anyElement.matches(selectorText);
  } catch {
    console.warn("[css-rules] 解釈できない selector", { selectorText });
    return false;
  }
}
