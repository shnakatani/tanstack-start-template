/** この関数が root に求めるもの。`Element` はこれを満たす */
export interface RootElement {
  matches(selectors: string): boolean;
  readonly ownerDocument: Document;
}

/** この関数が stylesheet に求めるもの。`CSSStyleSheet` はこれを満たす */
export interface ReadableStyleSheet {
  readonly href: string | null;
  readonly cssRules: Iterable<CSSRule>;
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

  /**
   * 別オリジンの stylesheet は `cssRules` を読めない。読めなかったことを残して先へ進む。
   * catch の範囲を走査全体にすると、深い位置の失敗でその stylesheet の残りが丸ごと落ちる。
   */
  const readRules = (
    read: () => Iterable<CSSRule>,
    href: string | null,
  ): Iterable<CSSRule> | null => {
    try {
      return read();
    } catch (error) {
      console.warn("[css-rules] cssRules を読めない stylesheet", { href, error });
      return null;
    }
  };

  const visit = (rules: Iterable<CSSRule>) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && isRootScoped(root, anyElement, rule.selectorText)) {
        for (const name of rule.style) {
          if (name.startsWith(prefix)) names.add(name);
        }
      }
      // @import が参照する stylesheet は CSSGroupingRule を継承しないので、別に辿る。
      // 辿らないと、その中の宣言が「トークンが無い」のと区別が付かない形で落ちる
      if (rule instanceof CSSImportRule) {
        // cross-origin の stylesheet では cssRules が SecurityError を投げる
        // (CSSOM「If the origin-clean flag is unset, throw a SecurityError exception.」)。
        // 読み取りごと readRules に入れて、走査全体が止まらないようにする
        const inner = readRules(() => {
          const imported = rule.styleSheet;
          if (imported === null) {
            // 読み込み前か失敗。chromium 153 では取得に失敗した @import が null になる
            // (2026-09-20 実測)。黙って飛ばすと「その stylesheet にトークンが無い」のと
            // 区別が付かなくなる。supports() の条件が偽のときに null を返す仕様も議論
            // されているが (w3c/csswg-drafts#8608)、chromium 153 は条件が偽でも取得して
            // 非 null を返す。条件で warn を止める分岐は置かず、supportsText を payload へ
            // 載せて読み手が切り分けられるようにする
            console.warn("[css-rules] styleSheet を読めない @import", {
              href: rule.href,
              supportsText: rule.supportsText,
            });
            return [];
          }
          return imported.cssRules;
        }, rule.href);
        if (inner !== null) visit(inner);
        continue;
      }
      if (rule instanceof CSSGroupingRule) visit(rule.cssRules);
    }
  };

  for (const sheet of sheets) {
    const rules = readRules(() => sheet.cssRules, sheet.href);
    if (rules !== null) visit(rules);
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
