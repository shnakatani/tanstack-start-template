/** 解決後の値を伴う CSS カスタムプロパティ。名前は `--` で始まる */
export interface ThemeToken {
  name: string;
  value: string;
}

const COLOR_ALIAS_PREFIX = "--color-";

/**
 * Tailwind の `@theme inline` が生成する `--color-X` のうち、生トークン `--X` と値まで一致する
 * ものを落とす。`--color-primary: var(--primary)` のような別名は一覧に並べても同じ値と
 * コントラスト比が二重に出るだけで、読む側は 2 行のどちらを見ればよいか判断できない。
 *
 * 値が食い違う別名は落とさず warn する。落としてよい根拠は「`var()` 経由の別名だから値が
 * 同じ」であって名前の綴りではないため、前提が崩れた別名を黙って消すと、一覧が本来見せる
 * ための drift をその一覧自身が隠すことになる。
 *
 * `--color-black` のように対応する生トークンを持たない宣言は残る (styles.css が `#000` を
 * 直接宣言している)。
 */
export function dropRedundantColorAliases(tokens: readonly ThemeToken[]): ThemeToken[] {
  const byName = new Map(tokens.map((token) => [token.name, token.value]));

  return tokens.filter(({ name, value }) => {
    if (!name.startsWith(COLOR_ALIAS_PREFIX)) return true;
    const raw = `--${name.slice(COLOR_ALIAS_PREFIX.length)}`;
    const rawValue = byName.get(raw);
    if (rawValue === undefined) return true;
    if (rawValue === value) return false;
    console.warn("[theme-tokens] 別名と生トークンの値が食い違う", {
      alias: name,
      aliasValue: value,
      raw,
      rawValue,
    });
    return true;
  });
}
