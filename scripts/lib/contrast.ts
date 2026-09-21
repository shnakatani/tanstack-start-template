/**
 * `src/styles.css` のトークンから WCAG のコントラスト比を計算する。
 *
 * 比を計算する手段がリポジトリに無いと、ADR に書いた値を誰も追試できず、トークンを
 * 動かしたあとの再測もできない (ADR-0028)。
 *
 * ここは検査ではない。合否は `src/components/contrast.stories.tsx` の axe が持つ
 * (ADR-0024 の節 5)。
 */

import Color from "colorjs.io";

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

export type Rgb = readonly [number, number, number];

/** sRGB の 0..1 の成分と alpha。整数へ丸めない */
export type Srgb = { readonly rgb: Rgb; readonly alpha: number };

/**
 * CSS の色を sRGB へ解決する。
 *
 * `toGamut` の形は axe-core 4.13.0 の `Color.parseString` に合わせている。合わせないと、
 * sRGB の外にある oklch で負の成分が残り、axe と別の比が出る (dequelabs/axe-core#4908)。
 *
 * 丸めない。丸めるのはブラウザが画面へ出すときで、値を選ぶための計算には要らない。
 */
export function resolveSrgb(value: string): Srgb {
  const color = new Color(value).toGamut({ space: "srgb", method: "clip" }).to("srgb");
  const { r, g, b } = color;
  const alpha = readAlpha(color);
  if (r === null || g === null || b === null || alpha === null) {
    // CSS Color 4 の `none`。別の色空間へ変換すると 0 に解決されるが、sRGB のまま渡された
    // `rgb(none 0 0)` では null が残る。0 として扱うと存在しない比が出る
    throw new Error(`none を含む色はコントラストを計算できない: ${value}`);
  }
  // `toGamut` は oklch 空間で clip するため、sRGB へ戻すと成分が -1e-17 のように範囲の外へ
  // わずかに出る (2026-09-22 に colorjs.io 0.7.1 で実測)。相対輝度の式は成分が [0, 1] に
  // あることを前提にするので、ここで収める。axe-core は輝度計算の前に clamp せず生値を読む
  // (`axe.js` の `getRelativeLuminance` が `this.r` を読み、clamp は 8bit 表示用の `_red`
  // にしか掛からない) が、はみ出しは 1e-15 の桁なので比への影響は無い
  return { rgb: [clampChannel(r), clampChannel(g), clampChannel(b)], alpha };
}

function clampChannel(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * colorjs.io 0.7.1 の型 (`Color#alpha`) は `number` で null を許さないが、alpha に `none`
 * を渡すと実際には null が返る (`rgb(0 0 0 / none)` で 2026-09-22 に実測)。関数境界で型を
 * 実態に合わせ直し、`typescript/no-unnecessary-condition` が本物の分岐を「到達しない」と
 * 誤判定しないようにする
 *
 * 同じ型定義の `PlainColorObject` (`color.d.ts:63`) は `alpha: number | null` と宣言して
 * おり、ここでの拡大はその側の宣言と揃える操作でもある。ただし `Color` クラス (同 :177) が
 * `implements PlainColorObject` のまま `number` へ狭めること自体は TypeScript が許す形なので、
 * 上流の誤りと断定はしない。上流には未報告 (2026-09-22 に color-js/color.js を検索して 0 件)
 */
function readAlpha(color: Color): number | null {
  return color.alpha;
}

/**
 * 面を下から順に重ねて 1 色にする。
 *
 * いちばん下が透けていたら throw する。下地が決まらないまま合成すると、何に載るかで
 * 変わる比を 1 つに決めてしまう。
 */
export function flattenLayers(layers: readonly Srgb[]): Rgb {
  const [bottom, ...rest] = layers;
  if (bottom === undefined || bottom.alpha !== 1) {
    throw new Error("いちばん下の面は不透明でなければならない");
  }
  return rest.reduce<Rgb>(
    (under, layer) => [
      layer.rgb[0] * layer.alpha + under[0] * (1 - layer.alpha),
      layer.rgb[1] * layer.alpha + under[1] * (1 - layer.alpha),
      layer.rgb[2] * layer.alpha + under[2] * (1 - layer.alpha),
    ],
    bottom.rgb,
  );
}

/**
 * WCAG 2.2 の relative luminance (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance)。
 *
 * 閾値は 0.04045 である。2021-05 より前の版は 0.03928 で、同 URL の Note 2 が差し替えを
 * 説明している。axe-core 4.13.0 も 0.04045 を使う (`axe.js` の `getRelativeLuminance`)。
 * 揃えないと、成分が 2 つの値の間に入る色だけ axe と違う比が出る
 */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.2 の contrast ratio。丸めない (SC 1.4.3 の note が計算値を丸めるなと書いている) */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

/** 画面へ出るときの色。ブラウザと axe はこの丸めた色を読む */
export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
