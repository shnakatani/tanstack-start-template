/**
 * `src/styles.css` のトークンから WCAG のコントラスト比を計算する。
 *
 * 比を計算する手段がリポジトリに無いと、ADR に書いた値を誰も追試できず、トークンを
 * 動かしたあとの再測もできない (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ
 * (ADR-0024 の節 5)。
 */

const THEME_SELECTOR = { light: ":root", dark: ".dark" } as const;

export type Theme = keyof typeof THEME_SELECTOR;

/**
 * トークン名から宣言された値を引く表。
 *
 * 色でない宣言 (`--radius`) も入る。`:root` の宣言をそのまま読むためで、色に絞る判定は
 * 値を解決する側が持つ。
 */
export type TokenTable = Readonly<Record<string, string>>;

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
  // セレクタを行頭に固定する。固定しないと `@media` が `:root` を外から包む形で、
  // 条件付きの値が無条件のトークンとして表へ入る。
  //
  // 行頭で足りるのは、入れ子を必ず字下げするフォーマッタを commit 前に通すからである
  // (AGENTS.md「コミット前に `vp check --fix` 必須」)。字下げなしの入れ子は
  // `vp check` が Formatting issues として弾く。フォーマッタを外すとこの前提が消える
  const found = new RegExp(`^${escapeForRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "m").exec(
    source,
  );
  const body = found?.[1];
  if (body === undefined) {
    // セレクタが在るのに当たらない形と、本当に無い形を区別する。区別しないと
    // 調べ始める場所を誤らせる
    throw new Error(
      source.includes(selector)
        ? `行頭のセレクタとして見つからない (字下げされているか、閉じ括弧が行頭にない): ${selector}`
        : `セレクタが見つからない: ${selector}`,
    );
  }
  if (body.includes("{")) {
    // 入れ子のブロック (`@media` など) があると、条件付きの値が無条件のトークンとして
    // 混ざる。閉じ括弧が行頭に無い CSS でも、次のブロックまで飲み込んで同じ形になる。
    // どちらも例外にならず静かに誤った比を返すので、ここで止める
    throw new Error(`宣言だけのブロックではない (入れ子か、閉じ括弧が行頭にない): ${selector}`);
  }
  const table: Record<string, string> = {};
  // 宣言は複数行にまたがる (`--destructive-surface`)。改行を潰してから ; で割る
  for (const declaration of body.replace(/\s+/g, " ").split(";")) {
    const parsed = /^\s*(--[a-z0-9-]+)\s*:\s*(.+)/i.exec(declaration);
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
