/**
 * `src/styles.css` のトークンから WCAG のコントラスト比を計算する。
 *
 * 比を計算する手段がリポジトリに無いと、ADR に書いた値を誰も追試できず、トークンを
 * 動かしたあとの再測もできない (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ
 * (ADR-0024 の節 5)。
 */

export type Theme = "light" | "dark";

/** トークン名から宣言された値を引く表 */
export type TokenTable = Readonly<Record<string, string>>;

const THEME_SELECTOR = { light: ":root", dark: ".dark" } as const;

/**
 * `:root` と `.dark` をトークンの表にする。
 *
 * `.dark` は `:root` に重ねる。dark で再宣言しないトークンは light の値のまま効くので、
 * 重ねないと「dark に無い」と「dark で light と同値」を区別できない。
 */
export function parseTokenTable(css: string): Readonly<Record<Theme, TokenTable>> {
  const light = parseBlock(css, THEME_SELECTOR.light);
  return { light, dark: { ...light, ...parseBlock(css, THEME_SELECTOR.dark) } };
}

function parseBlock(css: string, selector: string): TokenTable {
  // コメントを先に落とす。コメントの中に宣言の例を書くことがある
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = new RegExp(`${escapeForRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  const body = found?.[1];
  if (body === undefined) {
    throw new Error(`セレクタが見つからない: ${selector}`);
  }
  const table: Record<string, string> = {};
  // 宣言は複数行にまたがる (`--destructive-surface`)。改行を潰してから ; で割る
  for (const declaration of body.replace(/\s+/g, " ").split(";")) {
    const parsed = /\s*(--[a-z0-9-]+)\s*:\s*(.+)/i.exec(declaration);
    const [, name, value] = parsed ?? [];
    if (name !== undefined && value !== undefined) {
      table[name] = value.trim();
    }
  }
  return table;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
